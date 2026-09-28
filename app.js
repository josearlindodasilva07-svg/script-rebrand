"use strict";

const scriptInput = document.getElementById("scriptInput");
const oldNameInput = document.getElementById("oldName");
const newNameInput = document.getElementById("newName");
const oldImageInput = document.getElementById("oldImage");
const newImageInput = document.getElementById("newImage");
const resultOutput = document.getElementById("resultOutput");
const updateButton = document.getElementById("updateButton");
const copyButton = document.getElementById("copyButton");
const statusText = document.getElementById("status");

function setStatus(message, type) {
  statusText.textContent = message;
  statusText.style.color = type === "error" ? "crimson" : "green";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeImageId(value) {
  return value
    .trim()
    .replace(/^rbxassetid:\/\//i, "")
    .replace(/\D/g, "");
}

function replaceAllLiteral(source, oldValue, newValue) {
  if (!oldValue) {
    return source;
  }

  return source.replace(
    new RegExp(escapeRegExp(oldValue), "g"),
    function () {
      return newValue;
    }
  );
}

function replaceImageId(source, oldValue, newValue) {
  const oldId = normalizeImageId(oldValue);
  const newId = normalizeImageId(newValue);

  if (!oldId || !newId) {
    return source;
  }

  const oldAssetId = "rbxassetid://" + oldId;
  const newAssetId = "rbxassetid://" + newId;

  let result = source;

  // Troca formatos comuns usados em scripts Roblox.
  result = replaceAllLiteral(result, oldAssetId, newAssetId);

  // Também troca URLs de thumbnail que contenham o ID antigo.
  result = replaceAllLiteral(result, oldId, newId);

  return result;
}

updateButton.addEventListener("click", function () {
  const original = scriptInput.value;

  if (!original.trim()) {
    setStatus("Cole um script primeiro.", "error");
    resultOutput.value = "";
    return;
  }

  const oldName = oldNameInput.value;
  const newName = newNameInput.value;
  const oldImage = oldImageInput.value;
  const newImage = newImageInput.value;

  let result = original;

  if (oldName.trim() && newName.trim()) {
    result = replaceAllLiteral(result, oldName, newName);
  }

  if (oldImage.trim() && newImage.trim()) {
    result = replaceImageId(result, oldImage, newImage);
  }

  resultOutput.value = result;

  const nameChanged =
    oldName.trim() &&
    newName.trim() &&
    result !== original;

  const imageChanged =
    normalizeImageId(oldImage) &&
    normalizeImageId(newImage) &&
    result !== original;

  if (nameChanged || imageChanged) {
    setStatus("Script atualizado.", "success");
  } else {
    setStatus(
      "Nenhuma alteração feita. Confira os valores atuais.",
      "error"
    );
  }
});

copyButton.addEventListener("click", async function () {
  if (!resultOutput.value.trim()) {
    setStatus("Não há resultado para copiar.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(resultOutput.value);
    setStatus("Resultado copiado.", "success");
  } catch (error) {
    resultOutput.focus();
    resultOutput.select();
    document.execCommand("copy");
    setStatus("Resultado copiado.", "success");
  }
});
