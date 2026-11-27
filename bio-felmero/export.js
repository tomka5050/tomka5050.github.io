import { currentStudent, loginStudent, logoutStudent, firebaseClient } from "./auth-client.js";

const $ = id => document.getElementById(id);
let student = null;
let attempts = [];

function status(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("export-error", error);
}

function showLogin() {
  $("loginPanel").hidden = false;
  $("exportPanel").hidden = true;
  $("password").value = "";
  student = null;
  attempts = [];
}

function showExport() {
  $("loginPanel").hidden = true;
  $("exportPanel").hidden = false;
  $("userInfo").textContent = "Bejelentkezve: " + student.username;
}

function dateString(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  return typeof value === "string" ? value : null;
}

function formatAttempt(doc) {
  const data = doc.data();
  // A Firestore felhasználói UID nem szükséges a diagnosztikus elemzéshez.
  const { userUid, ...withoutUid } = data;
  return {
    ...withoutUid,
    attemptId: data.attemptId || doc.id,
    startedAt: dateString(data.startedAt),
    submittedAt: dateString(data.submittedAt),
    updatedAt: dateString(data.updatedAt)
  };
}

function filtered() {
  return attempts.filter(a => !$("finishedOnly").checked || a.completed === true);
}

function render() {
  const list = $("attemptList");
  list.replaceChildren();
  for (const attempt of attempts) {
    const item = document.createElement("li");
    const answered = Array.isArray(attempt.answers)
      ? attempt.answers.filter(a => typeof a.answer === "string" && a.answer.trim() !== "").length
      : 0;
    const when = attempt.updatedAt ? new Date(attempt.updatedAt).toLocaleString("hu-HU") : "ismeretlen időpont";
    item.textContent = (attempt.completed ? "Befejezve" : "Folyamatban") +
      " · " + answered + "/40 válasz · " + when;
    list.append(item);
  }
  if (!attempts.length) {
    const item = document.createElement("li");
    item.textContent = "Még nincs kitöltés ehhez a fiókhoz.";
    list.append(item);
  }
  $("downloadButton").disabled = filtered().length === 0;
  status(attempts.length + " kitöltés beolvasva a Firestore adatbázisból.");
}

async function refresh() {
  if (!student) return;
  $("refreshButton").disabled = true;
  $("downloadButton").disabled = true;
  status("Firestore-adatok lekérése…");
  try {
    const client = await firebaseClient();
    if (client.auth.currentUser?.uid !== student.uid) throw new Error("A munkamenet időközben lejárt.");
    // A Firestore szabályai csak a saját UID-vel szűrt queryt engedik.
    const query = client.firestoreSdk.query(
      client.firestoreSdk.collection(client.db, "attempts"),
      client.firestoreSdk.where("userUid", "==", student.uid)
    );
    const snap = await client.firestoreSdk.getDocs(query);
    attempts = snap.docs.map(formatAttempt).sort(
      (a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")
    );
    render();
  } catch (error) {
    attempts = [];
    $("attemptList").replaceChildren();
    status("A Firestore-adatok lekérése nem sikerült: " + (error?.code || error?.message || "ismeretlen hiba"), true);
  } finally {
    $("refreshButton").disabled = false;
    $("downloadButton").disabled = filtered().length === 0;
  }
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("loginButton").disabled = true;
  status("Bejelentkezés…");
  try {
    student = await loginStudent($("username").value, $("password").value);
    $("password").value = "";
    showExport();
    await refresh();
  } catch (error) {
    status("Bejelentkezési hiba. Ellenőrizd az adatokat és a felhasználó engedélyezését.", true);
  } finally {
    $("loginButton").disabled = false;
  }
});

$("finishedOnly").addEventListener("change", () => {
  $("downloadButton").disabled = filtered().length === 0;
});
$("refreshButton").addEventListener("click", refresh);
$("logoutButton").addEventListener("click", async () => {
  try { await logoutStudent(); }
  finally {
    showLogin();
    status("Kijelentkeztél.");
  }
});
$("downloadButton").addEventListener("click", () => {
  const rows = filtered();
  if (!rows.length) return;
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = "deeptutor-bio-attempts-" + date + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status(rows.length + " kitöltés exportálva. A fájl a böngésződ letöltési mappájában található.");
});

try {
  student = await currentStudent();
  if (student) {
    showExport();
    await refresh();
  } else {
    showLogin();
    status("Jelentkezz be a felmérőn használt fiókkal.");
  }
} catch (error) {
  showLogin();
  status("Nem sikerült ellenőrizni a bejelentkezést: " + (error?.code || error?.message || "ismeretlen hiba"), true);
}
