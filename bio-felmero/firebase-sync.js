// Debounced Firestore autosave. A localStorage mentés ettől függetlenül megmarad.
// Az írások sorban kerülnek elküldésre, így a későbbi válasz nem íródik felül régebbivel.
export function createRemoteSync(getConfig, onStatus) {
  let clientPromise = null;
  let pending = null;
  let timer = null;
  let queue = Promise.resolve();
  let revision = 0;

  async function client() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const config = getConfig();
        if (!config?.projectId) throw new Error("Nincs Firebase konfiguráció");
        const [appSdk, authSdk, firestoreSdk] = await Promise.all([
          import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
          import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js")
        ]);
        const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(config);
        const auth = authSdk.getAuth(app);
        // Megvárjuk, hogy a korábbi anonim bejelentkezés visszaálljon,
        // máskülönben a már elmentett kitöltéshez új UID miatt nem férnénk hozzá.
        await auth.authStateReady();
        const user = auth.currentUser || (await authSdk.signInAnonymously(auth)).user;
        return { db: firestoreSdk.getFirestore(app), firestoreSdk, uid: user.uid };
      })().catch(error => {
        clientPromise = null; // átmeneti hálózati hiba után újrapróbálható
        throw error;
      });
    }
    return clientPromise;
  }

  function schedule(snapshot, { immediate = false } = {}) {
    if (!getConfig()?.projectId) {
      onStatus("no-config", null, snapshot.attemptId);
      return;
    }
    // Minden írás teljes pillanatképet tartalmaz a 40 válaszhelyről.
    pending = JSON.parse(JSON.stringify(snapshot));
    revision += 1;
    onStatus("pending", null, snapshot.attemptId);
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { void flush(); }, immediate ? 0 : 1100);
  }

  function flush() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (!pending) return queue;
    const snapshot = pending;
    pending = null;
    const writingRevision = revision;

    // Soros írás: egy régebbi, lassabb hálózati kérés nem írhatja felül a frissebbet.
    queue = queue.catch(() => {}).then(async () => {
      try {
        const { db, firestoreSdk, uid } = await client();
        const document = {
          ...snapshot, userUid: uid,
          startedAt: new Date(snapshot.startedAt),
          submittedAt: snapshot.submittedAt ? new Date(snapshot.submittedAt) : null,
          updatedAt: new Date()
        };
        await firestoreSdk.setDoc(
          firestoreSdk.doc(db, "attempts", snapshot.attemptId),
          document
        );
        if (writingRevision === revision) {
          onStatus("synced", null, snapshot.attemptId);
        }
      } catch (error) {
        if (writingRevision === revision) {
          onStatus("failed", error?.code || error?.message || "Ismeretlen hiba", snapshot.attemptId);
        }
      }
    });
    return queue;
  }

  return { schedule, flush };
}
