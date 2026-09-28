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
  scanFunctions();
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

function scanFunctions() {
  const source = els.script.value;
  const masked = maskLua(source);
  const names = new Set();
  const patterns = [
    /\b(?:local\s+)?function\s+([A-Za-z_]\w*)(?:\s*[:.]\s*([A-Za-z_]\w*))?\s*\(/g,
    /\b(?:local\s+)?([A-Za-z_]\w*)\s*=\s*function\s*\(/g
  ];
  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(masked))) names.add(match[2] ? match[1] + "." + match[2] : match[1]);
  });
  els.functionSelect.innerHTML = "";
  if (!names.size) {
    els.functionSelect.innerHTML = '<option value="">Nenhuma função nomeada encontrada</option>';
    return;
  }
  els.functionSelect.add(new Option("Selecione uma função encontrada", ""));
  [...names].sort().forEach((name) => els.functionSelect.add(new Option(name, name)));
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

function functionRanges(source) {
  const masked = maskLua(source);
  const ranges = [];
  const starts = /\bfunction\b/g;
  let match;
  while ((match = starts.exec(masked))) {
    let start = match.index;
    const lineStart = masked.lastIndexOf("\n", start - 1) + 1;
    if (/^\s*local\s+$/.test(masked.slice(lineStart, start))) start = lineStart;
    const tail = masked.slice(start);
    const words = /\b(function|if|for|while|repeat|do|end|until)\b/g;
    let depth = 0, end = -1, word;
    while ((word = words.exec(tail))) {
      if (["function", "if", "for", "while", "repeat", "do"].includes(word[1])) depth++;
      else if (word[1] === "end" || word[1] === "until") {
        depth--;
        if (depth === 0) { end = start + word.index + word[0].length; break; }
      }
    }
    if (end > start) {
      const header = masked.slice(Math.max(0, start - 80), Math.min(masked.length, start + 160));
      const named = /function\s+([A-Za-z_]\w*(?:\s*[.:]\s*[A-Za-z_]\w*)?)/.exec(header);
      ranges.push({ start, end, name: named ? named[1].replace(/\s+/g, "") : "(função anônima)" });
    }
  }
  return ranges;
}

function findFunction(source, name) {
  const query = name.trim();
  if (!query) return null;
  const masked = maskLua(source);
  const normalized = query.replace(/\s+/g, "");
  const ranges = functionRanges(source);
  const named = ranges.filter((range) => range.name !== "(função anônima)" &&
    (range.name.toLowerCase() === normalized.toLowerCase() || range.name.toLowerCase().endsWith("." + normalized.toLowerCase())));
  if (named.length) return source.slice(named[0].start, named[0].end);
  return findFunctionContaining(source, query);
}

function findFunctionContaining(source, snippet) {
  const raw = snippet.trim();
  if (!raw) return null;
  const masked = maskLua(source);
  const pattern = raw.split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const found = new RegExp(pattern, "i").exec(masked);
  if (!found) return null;
  const originalPosition = found.index;
  const matchEnd = originalPosition + found[0].length;
  const containing = functionRanges(source).filter((range) => range.start <= matchEnd && range.end >= originalPosition);
  if (!containing.length) return null;
  const range = containing.sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
  return source.slice(range.start, range.end);
}

function extractDependencies(source, block) {
  const maskedSource = maskLua(source);
  const targetStart = source.indexOf(block);
  const ranges = functionRanges(source);
  const selected = new Set();
  const fragments = new Map();
  const names = new Set();
  const ignored = new Set(["local", "function", "if", "then", "end", "true", "false", "nil", "and", "or", "not", "task", "game", "self"]);
  const addNames = (text) => {
    const words = maskLua(text).match(/\b[A-Za-z_]\w*\b/g) || [];
    words.forEach((word) => { if (!ignored.has(word)) names.add(word); });
  };
  addNames(block);
  const addRange = (range) => {
    const key = range.start + ":" + range.end;
    if (selected.has(key)) return false;
    selected.add(key);
    fragments.set(range.start, source.slice(range.start, range.end).trim());
    addNames(source.slice(range.start, range.end));
    return true;
  };
  let changed = true;
  while (changed) {
    changed = false;
    ranges.forEach((range) => {
      if (range.start === targetStart || range.name === "(função anônima)") return;
      const shortName = range.name.split(".").pop();
      if (names.has(shortName) && addRange(range)) changed = true;
    });
  }
  const lines = source.split(/\r?\n/);
  let cursor = 0;
  lines.forEach((line) => {
    const lineStart = cursor; cursor += line.length + 1;
    if (lineStart >= targetStart && lineStart < targetStart + block.length) return;
    const insideFunction = ranges.some((range) => range.start < lineStart && range.end > lineStart && range.start !== targetStart);
    if (insideFunction) return;
    const clean = maskLua(line).trim();
    if (!clean) return;
    const declaration = /^(?:local\s+)?([A-Za-z_]\w*)\s*=/.exec(clean);
    const mentionsDependency = [...names].some((name) => new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(clean));
    const guiLine = /(?:Instance\.new|Create|Parent|Position|Size|Text|Visible|Enabled|MouseButton|Activated|Frame|Button|Gui|ScreenGui|UICorner|UIStroke|UIListLayout)/i.test(clean);
    if ((declaration && names.has(declaration[1])) || (mentionsDependency && guiLine)) fragments.set(lineStart, line.trim());
  });
  return [...fragments.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]).filter((item, index, all) => item && all.indexOf(item) === index);
}

function extractFunction(source, query) {
  if (!source.trim() || source.trim() === query.trim()) {
    return "-- Cole o script completo no campo Script completo.\n-- Cole apenas o trecho de referência no campo de extração.";
  }
  const block = findFunctionContaining(source, query) || findFunction(source, query);
  if (!block) return "-- Função não encontrada para o trecho: " + query.trim();
  const dependencies = extractDependencies(source, block).filter((line) => !block.includes(line));
  return "-- Shadow Changer V5: função completa + dependências conectadas encontradas no script principal\n" +
    (dependencies.length ? "-- Funções, objetos e configuração da GUI relacionados\n" + dependencies.join("\n\n") + "\n\n" : "") + block.trim() + "\n";
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

function mergeScripts(source) {
  const addition = els.mergeScript.value;
  if (!addition.trim()) return source;
  const separator = "\n\n-- Shadow Changer: segundo script adicionado abaixo --\n\n";
  const content = $("wrapMerge").checked ? "do\n" + addition.trim() + "\nend" : addition.trim();
  return source.trimEnd() + separator + content + "\n";
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
