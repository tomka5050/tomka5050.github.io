import { firebaseClient } from "./auth-client.js";

// Az adatbázis-írás sorosított, és minden válasz után követi a módosult teljes állapotot.
export function createRemoteSync(getActiveUid,onStatus) {
  let pending=null,timer=null,queue=Promise.resolve(),revision=0;
  function cancel() {
    revision++;
    if(timer!==null) clearTimeout(timer);
    pending=null;timer=null;
  }
  function schedule(snapshot,{immediate=false}={}) {
    if(!getActiveUid() || snapshot.userUid!==getActiveUid()) {
      onStatus("failed","Nincs bejelentkezett felhasználó.",snapshot.attemptId);
      return;
    }
    pending=JSON.parse(JSON.stringify(snapshot));
    revision++;
    onStatus("pending",null,snapshot.attemptId);
    if(timer!==null) clearTimeout(timer);
    timer=setTimeout(()=>{void flush();},immediate?0:1100);
  }
  function flush() {
    if(timer!==null)clearTimeout(timer);
    timer=null;
    if(!pending)return queue;
    const snapshot=pending,rev=revision;pending=null;
    queue=queue.catch(()=>{}).then(async()=>{
      if(snapshot.userUid!==getActiveUid())return;
      try {
        const c=await firebaseClient();
        if(c.auth.currentUser?.uid!==snapshot.userUid)throw new Error("Módosult a bejelentkezés.");
        await c.firestoreSdk.setDoc(
          c.firestoreSdk.doc(c.db,"attempts",snapshot.attemptId),
          {
            ...snapshot,
            startedAt:new Date(snapshot.startedAt),
            submittedAt:snapshot.submittedAt?new Date(snapshot.submittedAt):null,
            updatedAt:new Date(snapshot.updatedAt)
          }
        );
        if(rev===revision)onStatus("synced",null,snapshot.attemptId);
      } catch(e) {
        if(rev===revision)onStatus("failed",e?.code||e?.message||"Ismeretlen hiba",snapshot.attemptId);
      }
    });
    return queue;
  }
  return {schedule,flush,cancel};
}
