import { createRemoteSync } from "./firebase-sync.js";
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
const remote = createRemoteSync(
  () => window.BIO_FIREBASE_CONFIG,
  (status, error, attemptId) => {
    if (!state || state.attemptId !== attemptId) return;
    state.cloudStatus = status === "synced" && state.completed ? "ok" : status;
    state.syncError = error || null;
    localStorage.setItem(KEY, JSON.stringify(state));
    updateSyncStatus();
    if (state.completed && !$("done").hidden) {
      $("doneStatus").textContent =
        status === "synced" ? "A Firebase-mentés sikeres." :
        status === "failed" ? "Mentési hiba: " + error + ". A helyi másolat megmaradt." : "";
      renderDone();
    }
  }
);

function updateSyncStatus() {
  if (!$("syncState") || !state) return;
  const messages = {
    none: "Helyben mentve · Firebase mentés a válaszadáskor indul",
    pending: "Helyben mentve · Firebase: szinkronizálás folyamatban",
    synced: "Helyben és Firebase-ben mentve",
    failed: "Helyben mentve · Firebase-hiba: " + (state.syncError || "Próbáld újra"),
    "no-config": "Helyben mentve · A Firebase még nincs konfigurálva"
  };
  $("syncState").textContent = messages[state.cloudStatus] || "Helyben mentve";
  $("retryDraft").hidden = state.cloudStatus !== "failed";
}

function save({ upload = true, immediate = false } = {}) {
  if (upload && state && !state.completed) {
    remote.schedule(exportPayload(), { immediate });
  }
  localStorage.setItem(KEY, JSON.stringify(state));
  updateSyncStatus();
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
  updateSyncStatus();
  enteredAt = Date.now();
}
function go(delta) {
  handleTime();
  if (state.index === bank.questions.length - 1 && delta === 1) {
    finish();
    return;
  }
  state.index = Math.max(0, Math.min(bank.questions.length - 1, state.index + delta));
  save({ immediate: true });
  renderQuestion();
}
function exportPayload() {
  const end = state.submittedAt ? new Date(state.submittedAt).getTime() : Date.now();
  const elapsed = Math.min(604800, Math.max(0, Math.round((end - new Date(state.startedAt).getTime()) / 1000)));
  return {
    testId: bank.testId, schemaVersion: bank.version, attemptId: state.attemptId,
    studentCode: state.studentCode, startedAt: state.startedAt,
    submittedAt: state.submittedAt, completed: !!state.completed,
    updatedAt: new Date().toISOString(), durationSeconds: elapsed, consentVersion: "v1",
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
  state.completed = true;
  state.submittedAt = new Date().toISOString();
  state.cloudStatus = "pending";
  localStorage.setItem(KEY, JSON.stringify(state));
  renderDone();
  remote.schedule(exportPayload(), { immediate: true });
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
function retryCloudSave() {
  remote.schedule(exportPayload(), { immediate: true });
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
  if (!state) {state=newState();save({ upload: false });}
  if (state.completed) {
    renderDone();
  } else {
    renderQuestion();
    if (answeredCount() > 0) remote.schedule(exportPayload(), { immediate: true });
  }
});
$("reset").addEventListener("click",()=>{
  if (!confirm("Törlöd a helyben tárolt kitöltést? A már beküldött Firestore-adatok nem törlődnek.")) return;
  localStorage.removeItem(KEY);state=null;$("consent").checked=false;$("start").disabled=true;init();
});
$("previous").addEventListener("click",()=>go(-1));
$("next").addEventListener("click",()=>go(1));
$("download").addEventListener("click",downloadJson);
$("retryUpload").addEventListener("click", retryCloudSave);
$("retryDraft").addEventListener("click", () => remote.schedule(exportPayload(), { immediate: true }));
$("reload").addEventListener("click",()=>location.reload());
window.addEventListener("pagehide", () => {
  if (state && !state.completed) {
    handleTime();
    save({ upload: false }); // helyi mentés a lap bezárásakor is
    // Böngészőbezáráskor a hálózati írás nem garantálható.
  }
});
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
