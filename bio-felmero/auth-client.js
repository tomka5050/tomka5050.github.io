// A böngésző soha nem ismeri az adminisztrátori kulcsot.
// A felhasználónév egy belső Firebase Auth azonosító e-mail címre képeződik.
export const USERNAME_RE = /^[a-z][a-z0-9._-]{2,31}$/;
export function loginEmail(username) {
  const name = String(username || "").trim().toLowerCase();
  if (!USERNAME_RE.test(name)) throw new Error("A felhasználónév 3–32 karakter: kisbetű, szám, pont, kötőjel vagy aláhúzás; betűvel kezdődjön.");
  return "student-" + name + "@deeptutor-bio.firebaseapp.com";
}
let clientPromise;
export async function firebaseClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const cfg = window.BIO_FIREBASE_CONFIG;
      if (!cfg?.projectId) throw new Error("Hiányzik a Firebase-konfiguráció.");
      const [apps, authSdk, firestoreSdk] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js")
      ]);
      const app = apps.getApps().length ? apps.getApp() : apps.initializeApp(cfg);
      const auth = authSdk.getAuth(app);
      await auth.authStateReady();
      return {auth,authSdk,firestoreSdk,db:firestoreSdk.getFirestore(app)};
    })().catch(e => {clientPromise = null;throw e;});
  }
  return clientPromise;
}
export async function currentStudent() {
  const c = await firebaseClient();
  const user = c.auth.currentUser;
  if (!user) return null;
  if (user.isAnonymous) {
    await c.authSdk.signOut(c.auth); // régi anonim kitöltés nem keverhető név szerinti fiókkal
    return null;
  }
  const profile = await c.firestoreSdk.getDoc(c.firestoreSdk.doc(c.db,"users",user.uid));
  if (!profile.exists() || profile.data().active !== true || profile.data().role !== "student") {
    await c.authSdk.signOut(c.auth);
    return null;
  }
  return {uid:user.uid, username:profile.data().username};
}
export async function loginStudent(username,password) {
  const c=await firebaseClient();
  await c.authSdk.setPersistence(c.auth,c.authSdk.browserSessionPersistence);
  await c.authSdk.signInWithEmailAndPassword(c.auth,loginEmail(username),password);
  const user=await currentStudent();
  if (!user) throw new Error("A fiók nincs engedélyezve.");
  return user;
}
export async function logoutStudent() {
  const c=await firebaseClient();
  await c.authSdk.signOut(c.auth);
}
export async function loadOwnDraft(uid) {
  const c=await firebaseClient();
  const q=c.firestoreSdk.query(
    c.firestoreSdk.collection(c.db,"attempts"),
    c.firestoreSdk.where("userUid","==",uid),
    c.firestoreSdk.limit(30)
  );
  const result=await c.firestoreSdk.getDocs(q);
  const docs=result.docs.map(d=>d.data()).filter(d=>d.completed===false && d.testId==="BIO-DIAG-001");
  docs.sort((a,b)=>(b.updatedAt?.toMillis?.() || 0)-(a.updatedAt?.toMillis?.() || 0));
  return docs[0] || null;
}
