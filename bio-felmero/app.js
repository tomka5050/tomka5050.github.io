const KEY = "deeptutor-bio-diagnostic-v1";
const $ = (id) => document.getElementById(id);
let bank;
let state;
let enteredAt = Date.now();

function readState() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && v.testId === bank.testId && v.schemaVersion === bank.version
      && typeof v.answers === "object" && typeof v.attemptId === "string" ? v : null;
  } catch { return null; }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}
function newState() {
  const token = () => crypto.randomUUID();
  return {
    testId: bank.testId, schemaVersion: bank.version, attemptId: token(),
    studentCode: "BIO-" + token().replace(/-/g, "").slice(0, 10).toUpperCase(),
    startedAt: new Date().toISOString(), submittedAt: null, completed: false,
    cloudStatus: "none", answers: {}, spentSeconds: {}, index: 0
  };
}
function view(id) {
  for (const x of ["intro","quiz","done","errorPanel"]) $(x).hidden = x !== id;
}
function answered(a) {
  return !!a && typeof a.answer === "string" && a.answer.trim() !== "";
}
function answeredCount() {
  return Object.values(state.answers).filter(answered).length;
}
function activeQuestion() {
  return bank.questions[state.index];
}
function handleTime() {
  if (!state || state.completed) return;
  const q = activeQuestion();
  if (!q) return;
  const spent = Math.max(0, Math.round((Date.now() - enteredAt) / 1000));
  state.spentSeconds[q.id] = (state.spentSeconds[q.id] || 0) + spent;
  enteredAt = Date.now();
}
function ensureAnswer(q) {
  if (!state.answers[q.id]) {
    state.answers[q.id] = { answer: "", confidence: 0 };
  }
  return state.answers[q.id];
}
function changeAnswer(value) {
  const q = activeQuestion();
  ensureAnswer(q).answer = value;
  save();
  updateProgress();
}
function updateProgress() {
  const done = answeredCount();
  $("answeredCount").textContent = done + " / " + bank.questions.length + " megválaszolva";
  $("progress").setAttribute("aria-valuenow", String(done));
  $("progressFill").style.width = (100 * done / bank.questions.length) + "%";
}
function node(tag, cls, content) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (content !== undefined) el.textContent = content;
  return el;
}
function renderQuestion() {
  view("quiz");
  const q = activeQuestion(), previous = state.answers[q.id] || { answer: "", confidence: 0 };
  const topic = bank.topics.find(t => t.id === q.topic);
  $("topicLabel").textContent = (topic ? topic.name : q.topic).toUpperCase();
  $("quizTitle").textContent = "Kérdés " + (state.index + 1);
  $("counter").textContent = (state.index + 1) + " / " + bank.questions.length;
  $("kind").textContent = q.kind === "single" ? "Feleletválasztós" : "Rövid kifejtés";
  $("questionText").textContent = q.prompt;
  const target = $("answerArea");
  target.replaceChildren();
  if (q.kind === "single") {
    const group = node("div","choices");
    for (const option of q.options) {
      const label = node("label","choice" + (previous.answer === option.id ? " selected" : ""));
      const radio = node("input"); radio.type = "radio"; radio.name = "answer"; radio.value = option.id;
      radio.checked = previous.answer === option.id;
      radio.addEventListener("change", () => {
        changeAnswer(option.id);
        for (const x of group.querySelectorAll(".choice")) x.classList.remove("selected");
        label.classList.add("selected");
      });
      label.append(radio, node("span","choice-text",option.id + ". " + option.label));
      group.append(label);
    }
    const no = node("label","choice no-answer" + (previous.answer === "?" ? " selected" : ""));
    const radio = node("input"); radio.type = "radio"; radio.name = "answer"; radio.value = "?";
    radio.checked = previous.answer === "?";
    radio.addEventListener("change", () => {
      changeAnswer("?");
      for (const x of group.querySelectorAll(".choice")) x.classList.remove("selected");
      no.classList.add("selected");
    });
    no.append(radio,node("span","choice-text","Nem tudom"));
    group.append(no); target.append(group);
  } else {
    const txt = node("textarea","short-answer");
    txt.placeholder = "Írd ide a saját magyarázatodat. Ha nem tudod, hagyd üresen.";
    txt.setAttribute("aria-label","Szöveges válasz"); txt.maxLength = q.maxLength || 500;
    txt.value = previous.answer || "";
    txt.addEventListener("input",()=>changeAnswer(txt.value));
    target.append(txt);
  }
  const confidence = $("confidenceOptions");
  confidence.replaceChildren();
  for (const c of [{v:0,t:"Nem jelölöm"},{v:1,t:"Bizonytalan"},{v:2,t:"Részben biztos"},{v:3,t:"Biztos"}]) {
    const label = node("label");
    const radio = node("input"); radio.type = "radio"; radio.name = "confidence"; radio.value = String(c.v);
    radio.checked = Number(previous.confidence || 0) === c.v;
    radio.addEventListener("change",()=>{ensureAnswer(q).confidence=c.v;save();});
    label.append(radio,document.createTextNode(c.t)); confidence.append(label);
  }
  $("previous").disabled = state.index === 0;
  $("next").textContent = state.index === bank.questions.length-1 ? "Felmérő befejezése" : "Következő";
  updateProgress();
  enteredAt = Date.now();
}
function go(delta) {
  handleTime();
  if (state.index === bank.questions.length - 1 && delta === 1) {
    finish();
    return;
  }
  state.index = Math.max(0, Math.min(bank.questions.length - 1, state.index + delta));
  save();
  renderQuestion();
}
function exportPayload() {
  const elapsed = Math.min(604800, Math.max(0,Math.round((new Date(state.submittedAt).getTime() - new Date(state.startedAt).getTime()) / 1000)));
  return {
    testId: bank.testId, schemaVersion: bank.version, attemptId: state.attemptId,
    studentCode: state.studentCode, startedAt: state.startedAt,
    submittedAt: state.submittedAt, durationSeconds: elapsed, consentVersion: "v1",
    answers: bank.questions.map(q => ({
      questionId: q.id, topicId: q.topic, kind: q.kind,
      answer: state.answers[q.id]?.answer || "",
      confidence: Number(state.answers[q.id]?.confidence || 0),
      seconds: Number(state.spentSeconds[q.id] || 0)
    }))
  };
}
function downloadJson() {
  const data = exportPayload();
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  link.href=url;link.download="bio-felmero-" + state.studentCode + ".json";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function finish() {
  const missing = bank.questions.length-answeredCount();
  if (!confirm(missing ? missing + " kérdésnél nem adtál választ. Így is befejezed?" : "Befejezed és véglegesíted a felmérőt?")) return;
  state.completed=true;state.submittedAt=new Date().toISOString();
  state.cloudStatus="pending";save();renderDone();
  if (window.BIO_FIREBASE_CONFIG?.projectId) upload();
}
function renderDone() {
  view("done");
  $("doneSummary").textContent = answeredCount() + " kérdésre válaszoltál a 40-ből. A személyre szabott értékelés a mentett válaszok alapján készül.";
  $("studentCode").textContent=state.studentCode;
  const cloud=window.BIO_FIREBASE_CONFIG?.projectId;
  if (!cloud) {
    $("syncTitle").textContent="Helyi mentés – még nincs felhőkapcsolat";
    $("syncText").textContent="Az eredmények a böngésződben vannak. Töltsd le a JSON-fájlt, és oszd meg a felmérő szervezőjével. Firebase még nincs beállítva.";
  } else if (state.cloudStatus==="ok") {
    $("syncTitle").textContent="Sikeres felhőmentés";
    $("syncText").textContent="A válaszaid titkosított kapcsolaton keresztül eljutottak a Firestore adatbázisba. A JSON-másolatot is elmentheted.";
  } else if (state.cloudStatus==="failed") {
    $("syncTitle").textContent="A felhőmentés nem sikerült";
    $("syncText").textContent="A válaszaid helyileg megmaradtak. Letöltheted a JSON-t, vagy újrapróbálhatod a beküldést.";
  } else {
    $("syncTitle").textContent="Mentés folyamatban";
    $("syncText").textContent="Felhőbe küldés ellenőrzése. Ha nem sikerül, az eredmény helyben megmarad.";
  }
  $("retryUpload").hidden=!cloud || state.cloudStatus==="ok";
  $("retryUpload").disabled=state.cloudStatus==="pending";
}
async function upload() {
  if (!window.BIO_FIREBASE_CONFIG?.projectId) return;
  state.cloudStatus="pending";save();renderDone();
  try {
    // SDK letöltése csak beküldéskor szükséges: offline kipróbálásnál nem.
    const [a,b,c]=await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js")
    ]);
    const app=a.initializeApp(window.BIO_FIREBASE_CONFIG);
    const auth=b.getAuth(app);
    const credential=await b.signInAnonymously(auth);
    const db=c.getFirestore(app);
    const payload=exportPayload();
    payload.userUid=credential.user.uid;
    payload.startedAt=new Date(payload.startedAt);
    payload.submittedAt=new Date(payload.submittedAt);
    await c.setDoc(c.doc(db,"attempts",state.attemptId),payload);
    state.cloudStatus="ok";
    $("doneStatus").textContent="A felmérő beküldése sikeres.";
  } catch (e) {
    state.cloudStatus="failed";
    $("doneStatus").textContent="Beküldési hiba: " + (e?.code || e?.message || "Ismeretlen hiba") + ". Kérlek, töltsd le a JSON másolatot.";
  }
  save();renderDone();
}
function init() {
  state=readState();
  $("introStatus").textContent=state ? "Korábbi kitöltést találtunk ezen az eszközön." : "A kitöltés azonosítóval, név megadása nélkül történik.";
  $("start").textContent=state ? (state.completed?"Eredményem megnyitása":"Kitöltés folytatása") : "Felmérő indítása";
  $("reset").hidden=!state;
  view("intro");
}
$("consent").addEventListener("change",e=>$("start").disabled=!e.target.checked);
$("start").addEventListener("click",()=>{
  if (!$("consent").checked) return;
  if (!state) {state=newState();save();}
  if (state.completed) renderDone(); else renderQuestion();
});
$("reset").addEventListener("click",()=>{
  if (!confirm("Törlöd a helyben tárolt kitöltést? A már beküldött Firestore-adatok nem törlődnek.")) return;
  localStorage.removeItem(KEY);state=null;$("consent").checked=false;$("start").disabled=true;init();
});
$("previous").addEventListener("click",()=>go(-1));
$("next").addEventListener("click",()=>go(1));
$("download").addEventListener("click",downloadJson);
$("retryUpload").addEventListener("click",upload);
$("reload").addEventListener("click",()=>location.reload());
window.addEventListener("pagehide",()=>{if(state&&!state.completed){handleTime();save();}});
try {
  const response=await fetch("./questions.json",{cache:"no-store"});
  if (!response.ok) throw new Error("HTTP " + response.status);
  bank=await response.json();
  if (bank.questions?.length!==40||!bank.testId) throw new Error("Hibás kérdésbank.");
  init();
} catch(e) {
  view("errorPanel");
  $("errorMessage").textContent="A questions.json nem érhető el. Helyi fájlból történő megnyitás helyett használj HTTP-szervert. Részletek: " + e.message;
}
