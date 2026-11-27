# DeepTutor JSON export a bejelentkezett fiókból

A `/bio-felmero/export.html` oldalon a felhasználó beléphet ugyanazzal a fiókkal,
amellyel a kérdésekre válaszolt, és JSON fájlba mentheti a Firestore
`attempts` kollekciójából a **saját** kitöltéseit.

- A lekérdezés `where("userUid", "==", user.uid)` szűrést használ,
  és a `firestore.rules` saját adatokra korlátozó jogosultságát alkalmazza.
- Az összes elérhető kitöltés exportálható; egy jelölőnégyzettel csak a végleges
  (`completed: true`) rekordok tölthetők le.
- A dátummezők ISO 8601 karakterlánccá konvertálódnak.
- Az adatexport JSON-tömb, így feldolgozható az `admin/analyze.py` eszközzel;
  a Firebase Auth UID-t az export kihagyja, mert az elemzéshez nincs rá szükség.
- A kliens csak a saját adatokat olvashatja; ez **nem adminisztrátori export**.
  Más fiókok adatainak begyűjtéséhez az `admin/export_firestore.py` privát
  backend exportoló használható.
- A JSON fájl helyben töltődik le; Firebase Admin SDK kulcs nem kell hozzá.
- A JSON magánadatokat tartalmazhat: ne tedd nyilvános repóba, ne küldd
  illetékteleneknek, és csak az érintett hozzájárulásával oszd meg értékelésre.

## Gyors ellenőrzés

1. Nyisd meg: `https://tomka5050.github.io/bio-felmero/export.html`.
2. Jelentkezz be a felmérőben már működő felhasználónévvel és jelszóval.
3. A felület megmutatja a saját kitöltések számát és válaszainak számát.
4. Ha most csak részleges felmérés létezik, hagyd a „Csak a befejezett kitöltéseket” jelölőt kikapcsolva.
5. Kattints „JSON letöltése”; az exportált fájlt feltöltheted az elemzéshez.
