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
