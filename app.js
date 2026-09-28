"use strict";

const $ = (id) => document.getElementById(id);
const els = {
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
    if ($("replaceParts").checked) {
      const oldParts = oldValue.split(/\s+/);
      const newParts = newValue.split(/\s+/);
      if (oldParts.length === newParts.length) {
        oldParts.forEach((part, index) => {
          if (part.length > 2) result = replaceInsideStrings(result, part, newParts[index], true);
        });
      }
    }
  }
  return replaceImageIds(result);
}

function maskLua(source) {
  return source.replace(/(--\[(=*)\[[\s\S]*?\]\2\]|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[(=*)\[[\s\S]*?\]\3\])/g, (part) => part.replace(/[^\n]/g, " "));
}

function findFunction(source, name) {
  const safe = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!safe) return null;
  const startPattern = new RegExp(
    "(?:local\\s+)?function\\s+(?:[A-Za-z_]\\w*[.:])?" + safe + "\\s*\\(|(?:local\\s+)?" + safe + "\\s*=\\s*function\\s*\\(", "m"
  );
  const match = startPattern.exec(source);
  if (!match) return null;
  const masked = maskLua(source);
  const start = match.index;
  const tail = masked.slice(start);
  const words = /\b(function|if|for|while|repeat|do|end|until)\b/g;
  let depth = 0, last = -1, word;
  while ((word = words.exec(tail))) {
    if (["function", "if", "for", "while", "do"].includes(word[1])) depth++;
    else if (word[1] === "repeat") depth++;
    else if (word[1] === "end") { depth--; if (depth === 0) { last = word.index + word[0].length; break; } }
    else if (word[1] === "until") { depth--; if (depth === 0) { last = word.index + word[0].length; break; } }
  }
  return last === -1 ? source.slice(start) : source.slice(start, start + last);
}

function extractFunction(source, name) {
  const block = findFunction(source, name);
  if (!block) return "-- Função não encontrada: " + name;
  return "-- Extração segura da função: " + name + "\n" + block.trim() + "\n";
}

const dictionary = {
  pt: { Close: "Fechar", Settings: "Configurações", Loading: "Carregando", Button: "Botão", Open: "Abrir", Search: "Pesquisar", Save: "Salvar", Cancel: "Cancelar", Yes: "Sim", No: "Não", Enabled: "Ativado", Disabled: "Desativado" },
  en: { Fechar: "Close", Configurações: "Settings", Carregando: "Loading", Botão: "Button", Abrir: "Open", Pesquisar: "Search", Salvar: "Save", Cancelar: "Cancel", Sim: "Yes", Não: "No", Ativado: "Enabled", Desativado: "Disabled" },
  es: { Close: "Cerrar", Settings: "Configuración", Loading: "Cargando", Button: "Botón", Open: "Abrir", Search: "Buscar", Save: "Guardar", Cancel: "Cancelar", Yes: "Sí", No: "Não", Enabled: "Activado", Disabled: "Desativado" }
};
function translate(source, language) { const map = dictionary[language] || dictionary.pt; Object.keys(map).forEach((key) => { source = replaceInsideStrings(source, key, map[key], false); }); return source; }

$("scanButton").addEventListener("click", scanTexts);
els.select.addEventListener("change", () => { if (els.select.value) els.old.value = els.select.value; });
$("operation").addEventListener("change", (event) => { ["replacePanel", "extractPanel", "translatePanel"].forEach((id) => $(id).classList.add("hidden")); $(event.target.value === "replace" ? "replacePanel" : event.target.value === "extract" ? "extractPanel" : "translatePanel").classList.remove("hidden"); });
$("processButton").addEventListener("click", () => {
  const source = els.script.value;
  if (!source.trim()) { setStatus("Cole um script primeiro", "error"); return; }
  let result = source;
  const operation = $("operation").value;
  if (operation === "replace") result = changeBrand(source);
  if (operation === "extract") result = extractFunction(source, $("functionName").value);
  if (operation === "translate") result = translate(source, $("language").value);
  els.out.value = result; updateCounts(); setStatus(result === source ? "Nenhuma alteração feita" : "Processado com sucesso", result === source ? "error" : "success");
});
$("clearButton").addEventListener("click", () => { els.script.value = ""; els.out.value = ""; els.old.value = ""; els.next.value = ""; els.oldImg.value = ""; els.newImg.value = ""; $("functionName").value = ""; els.select.innerHTML = '<option value="">Cole o script e toque em “Encontrar textos”</option>'; els.scan.textContent = "Nenhum texto analisado"; setStatus("Aguardando"); updateCounts(); });
$("copyButton").addEventListener("click", async () => { if (!els.out.value.trim()) { setStatus("Não há resultado para copiar", "error"); return; } try { await navigator.clipboard.writeText(els.out.value); } catch (error) { els.out.select(); document.execCommand("copy"); } setStatus("Resultado copiado", "success"); });
$("downloadButton").addEventListener("click", () => { if (!els.out.value.trim()) { setStatus("Não há resultado para baixar", "error"); return; } const blob = new Blob([els.out.value], { type: "text/plain;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "script-atualizado.lua"; link.click(); URL.revokeObjectURL(link.href); setStatus("Arquivo baixado", "success"); });
updateCounts();
