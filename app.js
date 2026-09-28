"use strict";

const $ = (id) => document.getElementById(id);
const els = {
  file: $("fileInput"), fileStatus: $("fileStatus"),
  script: $("scriptInput"), select: $("textSelect"), old: $("oldName"), next: $("newName"),
  oldImg: $("oldImage"), newImg: $("newImage"), out: $("resultOutput"), status: $("status"),
  scan: $("scanStatus"), count: $("charCount"), info: $("resultInfo")
};

function setStatus(message, type) { els.status.textContent = message; els.status.className = "status " + (type || ""); }
function normalizeId(value) { return value.trim().replace(/^rbxassetid:\/\//i, "").replace(/\D/g, ""); }
function updateCounts() { els.count.textContent = els.script.value.length + " caracteres"; els.info.textContent = els.out.value.length + " caracteres"; }

function replaceInsideStrings(source, from, to, insensitive) {
  if (!from) return source;
  const pattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  return source.replace(pattern, function (literal) {
    const quote = literal[0];
    const body = literal.slice(1, -1);
    const flags = insensitive ? "gi" : "g";
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return quote + body.replace(new RegExp(escaped, flags), () => to) + quote;
  });
}

function replaceImageIds(source) {
  const oldId = normalizeId(els.oldImg.value);
  const newId = normalizeId(els.newImg.value);
  if (!oldId || !newId) return source;
  const oldAsset = "rbxassetid://" + oldId;
  const newAsset = "rbxassetid://" + newId;
  let result = replaceInsideStrings(source, oldAsset, newAsset, true);
  result = result.replace(new RegExp("(^|[^\\d])" + oldId + "(?!\\d)", "g"), (match, prefix) => prefix + newId);
  return result;
}

function scanTexts() {
  const found = [], seen = new Set();
  const pattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;
  let match;
  while ((match = pattern.exec(els.script.value))) {
    const value = match[0].slice(1, -1);
    if (value.length < 2 || value.length > 120 || seen.has(value)) continue;
    if (/^rbxassetid:\/\//i.test(value) || /^https?:\/\//i.test(value)) continue;
    seen.add(value); found.push(value);
  }
  els.select.innerHTML = "";
  if (!found.length) {
    els.select.innerHTML = '<option value="">Nenhum texto encontrado</option>';
    els.scan.textContent = "Nenhum texto encontrado";
    return;
  }
  els.select.add(new Option("Selecione um texto encontrado", ""));
  found.forEach((value) => els.select.add(new Option(value.length > 65 ? value.slice(0, 65) + "…" : value, value)));
  els.scan.textContent = found.length + " texto(s) encontrado(s)";
}

function changeBrand(source) {
  let result = source;
  const oldValue = els.old.value.trim();
  const newValue = els.next.value.trim();
  if (oldValue && newValue) {
    result = replaceInsideStrings(result, oldValue, newValue, true);
  }
  return replaceImageIds(result);
}

function maskLua(source) {
  return source.replace(/(--\[(=*)\[[\s\S]*?\]\2\]|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[(=*)\[[\s\S]*?\]\3\])/g, (part) => part.replace(/[^\n]/g, " "));
}

const terms = {
  close: { pt: "Fechar", en: "Close", es: "Cerrar" }, settings: { pt: "Configurações", en: "Settings", es: "Configuración" },
  loading: { pt: "Carregando", en: "Loading", es: "Cargando" }, button: { pt: "Botão", en: "Button", es: "Botón" },
  open: { pt: "Abrir", en: "Open", es: "Abrir" }, search: { pt: "Pesquisar", en: "Search", es: "Buscar" },
  save: { pt: "Salvar", en: "Save", es: "Guardar" }, cancel: { pt: "Cancelar", en: "Cancel", es: "Cancelar" },
  yes: { pt: "Sim", en: "Yes", es: "Sí" }, no: { pt: "Não", en: "No", es: "No" },
  enabled: { pt: "Ativado", en: "Enabled", es: "Activado" }, disabled: { pt: "Desativado", en: "Disabled", es: "Desactivado" }
};
function translate(source, language) {
  const aliases = {};
  Object.keys(terms).forEach((key) => Object.keys(terms[key]).forEach((lang) => { aliases[terms[key][lang]] = terms[key][language]; }));
  let result = source;
  Object.keys(aliases).sort((a, b) => b.length - a.length).forEach((from) => { if (from !== aliases[from]) result = replaceInsideStrings(result, from, aliases[from], false); });
  return result;
}

$('fileInput').addEventListener('change', () => {
  const file = $('fileInput').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { els.script.value = String(reader.result || ""); els.fileStatus.textContent = file.name; updateCounts(); scanTexts(); setStatus("Arquivo carregado", "success"); };
  reader.onerror = () => setStatus("Não foi possível ler o arquivo", "error");
  reader.readAsText(file);
});
$("scanButton").addEventListener("click", scanTexts);
els.select.addEventListener("change", () => { if (els.select.value) els.old.value = els.select.value; });
$("operation").addEventListener("change", (event) => { ["replacePanel", "translatePanel"].forEach((id) => $(id).classList.add("hidden")); $(event.target.value === "replace" ? "replacePanel" : "translatePanel").classList.remove("hidden"); });
$("processButton").addEventListener("click", () => {
  const source = els.script.value;
  if (!source.trim()) { setStatus("Cole um script primeiro", "error"); return; }
  let result = source;
  const operation = $("operation").value;
  if (operation === "replace") result = changeBrand(source);
  if (operation === "translate") result = translate(source, $("language").value);
  els.out.value = result; updateCounts(); setStatus(result === source ? "Nenhuma alteração feita" : "Processado com sucesso", result === source ? "error" : "success");
});
$("clearButton").addEventListener("click", () => { els.script.value = ""; els.out.value = ""; els.old.value = ""; els.next.value = ""; els.oldImg.value = ""; els.newImg.value = ""; els.file.value = ""; els.fileStatus.textContent = "Nenhum arquivo"; els.select.innerHTML = '<option value="">Cole o script e toque em “Encontrar textos”</option>'; els.scan.textContent = "Nenhum texto analisado"; setStatus("Aguardando"); updateCounts(); });
$("copyButton").addEventListener("click", async () => { if (!els.out.value.trim()) { setStatus("Não há resultado para copiar", "error"); return; } try { await navigator.clipboard.writeText(els.out.value); } catch (error) { els.out.select(); document.execCommand("copy"); } setStatus("Resultado copiado", "success"); });
$("downloadButton").addEventListener("click", () => { if (!els.out.value.trim()) { setStatus("Não há resultado para baixar", "error"); return; } const blob = new Blob([els.out.value], { type: "text/plain;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "script-atualizado.lua"; link.click(); URL.revokeObjectURL(link.href); setStatus("Arquivo baixado", "success"); });
updateCounts();


// Shadow Changer visual dashboard
const themeButton = $("themeButton");
const musicButton = $("musicButton");
const body = document.body;
const savedTheme = localStorage.getItem("shadow-theme");
if (savedTheme === "light") body.classList.add("light-theme");
themeButton.addEventListener("click", () => { body.classList.toggle("light-theme"); localStorage.setItem("shadow-theme", body.classList.contains("light-theme") ? "light" : "dark"); });
const visits = Number(localStorage.getItem("shadow-visits") || 0) + 1;
localStorage.setItem("shadow-visits", visits);
$("visitorCount").textContent = String(visits).padStart(3, "0");
function updateDashboardClock() { const now = new Date(); const time = now.toLocaleTimeString("pt-BR"); $("digitalClock").textContent = time; $("heroClock").textContent = time; $("dateToday").textContent = now.toLocaleDateString("pt-BR"); }
updateDashboardClock(); setInterval(updateDashboardClock, 1000);
setTimeout(() => $("loadingScreen").classList.add("hide"), 700);
const canvas = $("particles"), ctx = canvas.getContext("2d");
let particles = [];
function resizeParticles() { canvas.width = innerWidth; canvas.height = innerHeight; particles = Array.from({length: Math.min(75, Math.floor(innerWidth / 14))}, () => ({x: Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*1.8+.3,v:Math.random()*.35+.08,a:Math.random()*.7+.15})); }
function drawParticles() { ctx.clearRect(0,0,canvas.width,canvas.height); particles.forEach(p => { p.y += p.v; if(p.y > canvas.height) p.y = -4; ctx.globalAlpha=p.a; ctx.fillStyle="#8d82ff"; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); }); requestAnimationFrame(drawParticles); }
resizeParticles(); addEventListener("resize", resizeParticles); drawParticles();
const cursorGlow = $("cursorGlow");
addEventListener("pointermove", event => { cursorGlow.style.left = event.clientX + "px"; cursorGlow.style.top = event.clientY + "px"; });
let audioContext, oscillator, gain;
musicButton.addEventListener("click", () => { if (!audioContext) { audioContext = new (window.AudioContext || window.webkitAudioContext)(); oscillator = audioContext.createOscillator(); gain = audioContext.createGain(); oscillator.type="sine"; oscillator.frequency.value=110; gain.gain.value=.018; oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); musicButton.textContent="♫ ON"; } else if (audioContext.state === "running") { audioContext.suspend(); musicButton.textContent="♫"; } else { audioContext.resume(); musicButton.textContent="♫ ON"; } });
