"use strict";

const $ = (id) => document.getElementById(id);

const els = {
  file: $("fileInput"),
  fileStatus: $("fileStatus"),
  script: $("scriptInput"),
  select: $("textSelect"),
  old: $("oldName"),
  next: $("newName"),
  oldImg: $("oldImage"),
  newImg: $("newImage"),
  out: $("resultOutput"),
  status: $("status"),
  scan: $("scanStatus"),
  count: $("charCount"),
  info: $("resultInfo")
};

/* SOM DE CLIQUE */
const clickSound = new Audio("click.mp3");
clickSound.preload = "auto";
clickSound.volume = 0.35;
clickSound.load();

function playClick() {
  try {
    const sound = clickSound.cloneNode();
    sound.volume = 0.35;
    sound.play().catch(() => {});
  } catch (_) {}
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button, select");

  if (target) {
    playClick();
  }
});

function setStatus(message, type) {
  els.status.textContent = message;
  els.status.className = "status " + (type || "");
}

function normalizeId(value) {
  return value
    .trim()
    .replace(/^rbxassetid:\/\//i, "")
    .replace(/\D/g, "");
}

function updateCounts() {
  els.count.textContent =
    els.script.value.length + " caracteres";

  els.info.textContent =
    els.out.value.length + " caracteres";
}

function replaceInsideStrings(source, from, to, insensitive) {
  if (!from) return source;

  const pattern =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;

  return source.replace(pattern, function (literal) {
    const quote = literal[0];
    const body = literal.slice(1, -1);
    const flags = insensitive ? "gi" : "g";

    const escaped = from.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    return (
      quote +
      body.replace(
        new RegExp(escaped, flags),
        () => to
      ) +
      quote
    );
  });
}

function replaceImageIds(source) {
  const oldId = normalizeId(els.oldImg.value);
  const newId = normalizeId(els.newImg.value);

  if (!oldId || !newId) {
    return source;
  }

  const oldAsset =
    "rbxassetid://" + oldId;

  const newAsset =
    "rbxassetid://" + newId;

  let result = replaceInsideStrings(
    source,
    oldAsset,
    newAsset,
    true
  );

  result = result.replace(
    new RegExp(
      "(^|[^\\d])" +
      oldId +
      "(?!\\d)",
      "g"
    ),
    (match, prefix) =>
      prefix + newId
  );

  return result;
}

function scanTexts() {
  const found = [];
  const seen = new Set();

  const pattern =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g;

  let match;

  while (
    (match = pattern.exec(
      els.script.value
    ))
  ) {
    const value =
      match[0].slice(1, -1);

    if (
      value.length < 2 ||
      value.length > 120 ||
      seen.has(value)
    ) {
      continue;
    }

    if (
      /^rbxassetid:\/\//i.test(value) ||
      /^https?:\/\//i.test(value)
    ) {
      continue;
    }

    seen.add(value);
    found.push(value);
  }

  els.select.innerHTML = "";

  if (!found.length) {
    els.select.innerHTML =
      '<option value="">Nenhum texto encontrado</option>';

    els.scan.textContent =
      "Nenhum texto encontrado";

    return;
  }

  els.select.add(
    new Option(
      "Selecione um texto encontrado",
      ""
    )
  );

  found.forEach((value) => {
    els.select.add(
      new Option(
        value.length > 65
          ? value.slice(0, 65) + "â€¦"
          : value,
        value
      )
    );
  });

  els.scan.textContent =
    found.length +
    " texto(s) encontrado(s)";
}

function changeBrand(source) {
  let result = source;

  const oldValue =
    els.old.value.trim();

  const newValue =
    els.next.value.trim();

  if (oldValue && newValue) {
    result = replaceInsideStrings(
      result,
      oldValue,
      newValue,
      true
    );
  }

  return replaceImageIds(result);
}

function maskLua(source) {
  return source.replace(
    /(--\[(=*)\[[\s\S]*?\]\2\]|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[(=*)\[[\s\S]*?\]\3\])/g,
    (part) =>
      part.replace(/[^\n]/g, " ")
  );
}

const terms = {
  close: {
    pt: "Fechar",
    en: "Close",
    es: "Cerrar"
  },

  settings: {
    pt: "ConfiguraÃ§Ãµes",
    en: "Settings",
    es: "ConfiguraciÃ³n"
  },

  loading: {
    pt: "Carregando",
    en: "Loading",
    es: "Cargando"
  },

  button: {
    pt: "BotÃ£o",
    en: "Button",
    es: "BotÃ³n"
  },

  open: {
    pt: "Abrir",
    en: "Open",
    es: "Abrir"
  },

  search: {
    pt: "Pesquisar",
    en: "Search",
    es: "Buscar"
  },

  save: {
    pt: "Salvar",
    en: "Save",
    es: "Guardar"
  },

  cancel: {
    pt: "Cancelar",
    en: "Cancel",
    es: "Cancelar"
  },

  yes: {
    pt: "Sim",
    en: "Yes",
    es: "SÃ­"
  },

  no: {
    pt: "NÃ£o",
    en: "No",
    es: "No"
  },

  enabled: {
    pt: "Ativado",
    en: "Enabled",
    es: "Activado"
  },

  disabled: {
    pt: "Desativado",
    en: "Disabled",
    es: "Desactivado"
  }
};

function translate(source, language) {
  const aliases = {};

  Object.keys(terms).forEach((key) => {
    Object.keys(terms[key]).forEach((lang) => {
      aliases[terms[key][lang]] =
        terms[key][language];
    });
  });

  let result = source;

  Object.keys(aliases)
    .sort(
      (a, b) =>
        b.length - a.length
    )
    .forEach((from) => {
      if (
        from !== aliases[from]
      ) {
        result =
          replaceInsideStrings(
            result,
            from,
            aliases[from],
            false
          );
      }
    });

  return result;
}

$("fileInput").addEventListener(
  "change",
  () => {
    const file =
      $("fileInput").files[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = () => {
      els.script.value =
        String(
          reader.result || ""
        );

      els.fileStatus.textContent =
        file.name;

      updateCounts();
      scanTexts();

      setStatus(
        "Arquivo carregado",
        "success"
      );
    };

    reader.onerror = () => {
      setStatus(
        "NÃ£o foi possÃ­vel ler o arquivo",
        "error"
      );
    };

    reader.readAsText(file);
  }
);

$("scanButton").addEventListener(
  "click",
  scanTexts
);

els.select.addEventListener(
  "change",
  () => {
    if (els.select.value) {
      els.old.value =
        els.select.value;
    }
  }
);

$("operation").addEventListener(
  "change",
  (event) => {
    [
      "replacePanel",
      "translatePanel"
    ].forEach((id) => {
      $(id).classList.add(
        "hidden"
      );
    });

    $(
      event.target.value ===
        "replace"
        ? "replacePanel"
        : "translatePanel"
    ).classList.remove(
      "hidden"
    );
  }
);

$("processButton").addEventListener(
  "click",
  () => {
    const source =
      els.script.value;

    if (!source.trim()) {
      setStatus(
        "Cole um script primeiro",
        "error"
      );

      return;
    }

    let result = source;

    const operation =
      $("operation").value;

    if (
      operation === "replace"
    ) {
      result =
        changeBrand(source);
    }

    if (
      operation === "translate"
    ) {
      result = translate(
        source,
        $("language").value
      );
    }

    els.out.value = result;

    updateCounts();

    setStatus(
      result === source
        ? "Nenhuma alteraÃ§Ã£o feita"
        : "Processado com sucesso",
      result === source
        ? "error"
        : "success"
    );
  }
);

$("clearButton").addEventListener(
  "click",
  () => {
    els.script.value = "";
    els.out.value = "";
    els.old.value = "";
    els.next.value = "";
    els.oldImg.value = "";
    els.newImg.value = "";
    els.file.value = "";

    els.fileStatus.textContent =
      "Nenhum arquivo";

    els.select.innerHTML =
      '<option value="">Cole o script e toque em â€œEncontrar textosâ€</option>';

    els.scan.textContent =
      "Nenhum texto analisado";

    setStatus("Aguardando");

    updateCounts();
  }
);

$("copyButton").addEventListener(
  "click",
  async () => {
    if (!els.out.value.trim()) {
      setStatus(
        "NÃ£o hÃ¡ resultado para copiar",
        "error"
      );

      return;
    }

    try {
      await navigator.clipboard.writeText(
        els.out.value
      );
    } catch (error) {
      els.out.select();
      document.execCommand(
        "copy"
      );
    }

    setStatus(
      "Resultado copiado",
      "success"
    );
  }
);

$("downloadButton").addEventListener(
  "click",
  () => {
    if (!els.out.value.trim()) {
      setStatus(
        "NÃ£o hÃ¡ resultado para baixar",
        "error"
      );

      return;
    }

    const blob = new Blob(
      [els.out.value],
      {
        type:
          "text/plain;charset=utf-8"
      }
    );

    const link =
      document.createElement("a");

    link.href =
      URL.createObjectURL(blob);

    link.download =
      "script-atualizado.lua";

    link.click();

    URL.revokeObjectURL(
      link.href
    );

    setStatus(
      "Arquivo baixado",
      "success"
    );
  }
);

updateCounts();
