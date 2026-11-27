const { test }=require("node:test");
const { readFileSync }=require("node:fs");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,getDoc,getDocs,collection,where,query,Timestamp}=require("firebase/firestore");
let env;
function example(id,uid,complete=false) {
  return {
    testId:"BIO-DIAG-001",schemaVersion:1,attemptId:id,studentCode:"BIO-DEMO1234",
    userUid:uid,startedAt:Timestamp.fromDate(new Date("2026-11-01T12:00:00Z")),
    submittedAt:complete?Timestamp.fromDate(new Date("2026-11-01T13:00:00Z")):null,
    updatedAt:Timestamp.fromDate(new Date("2026-11-01T12:30:00Z")),
    completed:complete,durationSeconds:1800,consentVersion:"v1",
    answers:Array.from({length:40},(_,i)=>({
      questionId:"BIO-"+String(i+1).padStart(3,"0"),topicId:"alapok",
      kind:"single",answer:i===0?"A":"",confidence:1,seconds:3
    }))
  };
}
test("Only enrolled password users can create, change and read own attempts",async()=>{
  env=await initializeTestEnvironment({
    projectId:"demo-deeptutor-bio",
    firestore:{rules:readFileSync("firestore.rules","utf8")}
  });
  try {
    await env.withSecurityRulesDisabled(async ctx=>{
      await setDoc(doc(ctx.firestore(),"users","uidA"),{username:"diak01",active:true,role:"student"});
      await setDoc(doc(ctx.firestore(),"users","uidB"),{username:"diak02",active:true,role:"student"});
      await setDoc(doc(ctx.firestore(),"users","uidX"),{username:"blocked",active:false,role:"student"});
    });
    const owner=env.authenticatedContext("uidA",{firebase:{sign_in_provider:"password"}}).firestore();
    const other=env.authenticatedContext("uidB",{firebase:{sign_in_provider:"password"}}).firestore();
    const anon=env.authenticatedContext("uidA",{firebase:{sign_in_provider:"anonymous"}}).firestore();
    const blocked=env.authenticatedContext("uidX",{firebase:{sign_in_provider:"password"}}).firestore();
    const attempt=doc(owner,"attempts","attempt-001");
    await assertSucceeds(setDoc(attempt,example("attempt-001","uidA")));
    await assertSucceeds(getDoc(attempt));
    await assertFails(getDoc(doc(other,"attempts","attempt-001")));
    await assertFails(setDoc(doc(other,"attempts","attempt-001"),example("attempt-001","uidB")));
    await assertFails(setDoc(doc(anon,"attempts","attempt-anon"),example("attempt-anon","uidA")));
    await assertFails(setDoc(doc(blocked,"attempts","attempt-blocked"),example("attempt-blocked","uidX")));
    await assertFails(setDoc(doc(owner,"users","uidA"),{active:false}));
    await assertSucceeds(getDocs(query(collection(owner,"attempts"),where("userUid","==","uidA"))));
    await assertFails(getDocs(collection(other,"attempts")));
    await assertSucceeds(setDoc(attempt,{...example("attempt-001","uidA"),durationSeconds:1900}));
    await assertSucceeds(setDoc(attempt,example("attempt-001","uidA",true)));
    await assertFails(setDoc(attempt,example("attempt-001","uidA",false)));
  } finally { await env.cleanup(); }
});
