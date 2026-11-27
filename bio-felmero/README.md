# DeepTutor – emelt biológia diagnosztikus felmérő

Ez a projekt első, magyar nyelvű webes diagnosztikus felmérője. A weboldal a **/bio-felmero/** mappából kiszolgálható GitHub Pages alatt. A válaszok opcionálisan Firebase Cloud Firestore-ba kerülnek; amíg nincs konfigurálva, helyben menthetők és JSON-ként exportálhatók.

## Mit tartalmaz?
- 40 kérdés, 6 témakör (34 négyválasztós + 6 rövid szöveges);
- mobilbarát, egy kérdéses felület, visszalépés, folyamatos helyi mentés (localStorage);
- önkéntes adatkezelési hozzájárulás, név és e-mail bekérése nélkül;
- egyedi kitöltésazonosító; JSON-export a kitöltőnek;
- automatikus Firebase Authentication + Firestore mentés válaszadáskor, befejezetlen kitöltés esetén is (szövegnél 1,1 s késleltetéssel);
- a felhőmentés állapota látható; hiba esetén helyi mentés és újrapróbálás;
- alapértelmezett tiltó Firestore Security Rules;
- admin export Python script (külön, titkos service account kulccsal).
- Nincs javítókulcs a nyilvános weboldalon.

## Kipróbálás
Nyisd meg a `index.html` fájlt egy helyi HTTP-kiszolgálóról (pl. `python -m http.server 8000` a repo gyökerében), majd a `http://localhost:8000/bio-felmero/` címet, vagy publikáld a GitHub Pages oldalon. A kérdéseket `questions.json` tartalmazza.

## Firebase beállítás (a projekt tulajdonosának)
1. [Firebase Console](https://console.firebase.google.com/) > új projekt, **Spark** (ingyenes) csomag.
2. Project settings > Your apps: Web app regisztráció. Az ott kapott **webes konfigurációt** másold be a `firebase-config.js` fájlba a `window.BIO_FIREBASE_CONFIG` értékeként.
3. Build > Authentication > Sign-in method > **Anonymous** engedélyezése.
4. Build > Firestore Database > Create database. Production mode / tiltó szabályokkal indulj.
5. Firestore > Rules: a **FRISSÍTETT** `firestore.rules` teljes tartalmát publikáld. A korábbi szabályok csak a végleges 40 válaszos beküldést engedték, ezért az automatikus részmentéshez **kötelező az új Rules**. **Ne használj test mode vagy nyílt olvasási szabályt!**
6. Authentication > Settings > Authorized domains alatt add hozzá a `tomka5050.github.io` domaint, ha szükséges.
7. Nyisd meg az oldalt, jelöld a hozzájárulást, válaszolj **1 kérdésre**. Ellenőrizd a `attempts` kollekcióban a rekordot: `completed: false`, `submittedAt: null` és az első válasz már látható. Válaszolj még egy kérdésre: ugyanaz a dokumentum frissüljön.
8. A teszt végén a rekord legyen `completed: true`, `submittedAt` időbélyeggel, és a felület jelezze a felhőmentés sikerét.
9. A titkos szolgáltatásifiók-kulcsot **soha ne másold a GitHub-repóba, a böngészős kódba vagy Firebase configba**.

## Firestore export (csak rendszergazdának, saját gépen)
1. Telepítés: `pip install firebase-admin`.
2. A Firebase Console > Project settings > Service accounts alatt generált JSON-kulcsot mentsd a saját gépedre egy repo-n **kívüli** mappába.
3. Állítsd a `GOOGLE_APPLICATION_CREDENTIALS` környezeti változót a privát kulcsfájl abszolút útvonalára.
4. Futtasd: `python bio-felmero/admin/export_firestore.py export.json`. Az export nem kerül automatikusan GitHubra.
5. Az exportált JSON már feltölthető a ChatGPT/DeepTutor elemzéséhez, de csak a kitöltők tájékoztatásának megfelelően.

## Adatvédelem és korlátok
- Az anonim azonosító nem garantál abszolút anonimitást. Ne kérj személyes vagy egészségügyi adatokat a szöveges válaszokban.
- A böngészőben tárolt állapot a böngésző adatainak törlésekor elveszhet; JSON export azonnal lehetséges.
- A helyi tárolás ugyanazon domainen más böngésző- vagy eszközprofilból nem elérhető.
- A Firestore szabályok nem tekinthetők anti-bot megoldásnak; nyilvános éles használathoz App Check és abuse monitoring ajánlott.
- Ez **diagnosztikus**, nem felügyelt vizsga; a kérdések nyilvánosak, a javítókulcs nem.
- Szöveges válaszok automatikus megbízható pontozásához külön privát értékelő és manuális ellenőrzés szükséges.
- A Firestore ingyenes keret és a GitHub Pages feltételei változhatnak: indulás előtt ellenőrizd a hivatalos dokumentációt.

## Publikálás
A már létező `tomka5050.github.io` repóban történő egyesítés után (ha GitHub Pages a `main` branch root mappáját publikálja) az oldal címe várhatóan:
`https://tomka5050.github.io/bio-felmero/`

Minden módosítás önálló `bio-felmero/` könyvtárban van; a főoldal nem változik.

## Automatikus mentés – működés
- A feleletválasztós és szöveges válaszok is `attempts/{attemptId}` dokumentumba kerülnek.
- Szöveges gépeléskor 1100 ms után szinkronizálunk; kérdésváltáskor azonnal.
- A Firestore-dokumentum 40 válaszhelyet tartalmaz, beleértve az üreseket is. A `completed: false` jelzi, hogy a diák még dolgozik.
- Az írások sorosítva történnek: régebbi kérés nem írhatja felül az újabb adatokat.
- Hálózati hiba esetén a válaszok helyben megmaradnak. Válaszváltoztatáskor vagy a „Felhőmentés újrapróbálása” gombbal a szinkronizálás ismét elindul.
- A Firebase anonim fiók böngészőhöz kötött; böngészőadatok törlése után a régi draft szerkesztése nem garantált. A kitöltő eredményének JSON-exportja továbbra is elérhető.
- Éles használat előtt tanácsos Firestore Rules emulator tesztet és App Check védelmet is bekapcsolni.


## v2 – kizárólag adminisztrátor által kiosztott felhasználónév + jelszó
**Még nem éles.** A PR összevonása előtt teljesítsd a "Kötelező élesítés" sorrendet.

- Felhasználónév: 3–32 karakter, kisbetű + szám + pont/kötőjel/aláhúzás, betűvel kezdődjön.
- A webapp a Firebase Auth e-mail/jelszó szolgáltatását használja, de a diáknak csak felhasználónevet mutat.
- A technikai belső azonosító: student-\`felhasználónév\`@deeptutor-bio.firebaseapp.com (nem valódi levelezési cím).
- Elfelejtett jelszó: adminisztrátor állítja vissza; nincs e-mailes jelszó-visszaállítás, és a Firebase felhasználói profilokhoz nem állítunk be emailVerified=true-t.
- A fiókok csak a **Firebase Admin SDK** és a \`users/{uid}\` engedélyezett profil együttes megléte esetén használhatók.
- Saját \`users/{uid}\` profil olvasható; saját \`attempts\` dokumentumok olvashatók és menthetők; más diák adatai nem.
- Az előző anonim felméréseket **nem társítjuk automatikusan** új fiókokhoz. A régi böngészős adat egy külön exportgombbal menthető.
- A JavaScript kliensben és a repo fájljaiban nincs adminjelszó, Admin SDK hitelesítő adat vagy privát fiókkulcs.

### Kötelező egyszeri Firebase-beállítás
1. Authentication → Sign-in method: **Email/Password** aktiválása.
2. Authentication → Settings → User actions: **End-user account creation / sign-up** és **end-user deletion** tiltása. Az admin továbbra is hozhat létre fiókot. Ezt ellenőrizni kell egy valódi próbával.
3. A Firebase jelszóházirendben erős jelszavakat követelj meg, és legyen aktív az e-mail-címek létezésének felderítését korlátozó védelem.
4. Adminisztrátori környezetben: \`pip install firebase-admin\`, majd \`gcloud auth application-default login\` vagy az admin saját biztonságos hitelesítése. A \`GOOGLE_CLOUD_PROJECT=deeptutor-bio\` érték legyen elérhető.
5. \`python bio-felmero/admin/manage_users.py add diak01\` – kiír egy egyedi, véletlenszerű kezdeti jelszót. Ne add meg ChatGPT-ben, GitHubon vagy nyílt csatornán.
6. \`python bio-felmero/admin/manage_users.py reset diak01\` – jelszó reset; \`disable diak01\` – fiók tiltása.
7. Az új Firestore-szabályok kötelezők a fiókalapú belépéshez; anonim hozzáférést már nem engednek.

### Automatikus szabálytelepítés – GitHub Actions
A \`.github/workflows/deeptutor-firestore.yml\` PR-ben ellenőrzi a Firestore-szabályokat a helyi emulátorral. A tényleges szabálytelepítés **kikapcsolt**, amíg az alábbi egyszeri lépések meg nem történnek.

1. Google Cloud: hozz létre külön telepítő **service accountot**, csak a szabálytelepítéshez szükséges IAM jogokkal (pl. \`roles/firebaserules.admin\`, és az API által szükséges Firebase-projekt olvasási jogosultsággal). Ne használj személyes tulajdonosi azonosítót.
2. Hozz létre **Workload Identity Federation** poolt/providert GitHub OIDC-hoz; a trust feltétel szűkítsen erre: \`tomka5050/tomka5050.github.io\`, lehetőleg kizárólag \`main\` branch és \`firebase-production\` GitHub environment. A providerrel engedélyezd ennek a service accountnak az impersonationját.
3. GitHub repo Settings → Secrets and variables → Actions → Secrets: \`GCP_WIF_PROVIDER\` és \`GCP_DEPLOYER_SERVICE_ACCOUNT\`; a repó Actions Variables szekciójában \`FIREBASE_DEPLOY_ENABLED=true\` csak sikeres teszt után.
4. A \`firebase-production\` környezetben lehetőség szerint állíts be jóváhagyást, hogy az éles adatbázisszabályok változása kontrollált legyen.
5. A \`firebase.json\` kizárólag a \`firestore.rules\` fájlt telepíti, **nem** telepít új Firebase Hostingot; a GitHub Pages továbbra is a frontend hosztja.
6. A CI a \`firebase deploy --only firestore:rules --project deeptutor-bio --non-interactive\` parancsot futtatja. Ha nincs bekapcsolva, a deploy job skip státuszt kap.
7. A Firestore-szabályok visszaállításához a kívánt korábbi szabályfájlt új committal ismét telepíteni kell; a Firebase CLI nem kínál egyszerű szabály-visszagörgetést.

### Meglévő PR és migráció
Az eredeti automatikus mentés fejlesztés PR #2-ben anonim belépést használt. A fiókalapú verzió ezt magába foglalja és lecseréli az Anonymous sign-in hívást.
**Ne egyesítsd külön a PR #2-t az új bejelentkezős verzió helyett.**
Az átállás előtt a már folyamatban lévő anonim kitöltéseket fejezzétek be vagy exportáljátok JSON-ként, mert az új Firestore-szabályok nem engedik őket továbbírni.
