const form = document.querySelector("#story-form");
const keywordCountGroup = document.querySelector("#keyword-count-group");
const keywordsContainer = document.querySelector("#keywords-container");
const inputError = document.querySelector("#input-error");
const submitBtn = document.querySelector("#submit-btn");
const resetBtn = document.querySelector("#reset-btn");

const loadingSection = document.querySelector("#loading-section");
const loadingLabel = document.querySelector("#loading-label");
const loadingPercent = document.querySelector("#loading-percent");
const loadingBar = document.querySelector("#loading-bar");

const resultSection = document.querySelector("#result-section");
const storyOutput = document.querySelector("#story-output");
const wordCounter = document.querySelector("#word-counter");
const downloadBtn = document.querySelector("#download-btn");
const copyBtn = document.querySelector("#copy-btn");

const MAX_KEYWORDS = 5;
const MIN_KEYWORDS = 1;

let currentStory = "";
let progressTimer = null;

function getSelectedCount() {
  const selected = keywordCountGroup.querySelector(
    'input[name="keyword-count"]:checked',
  );
  return Number(selected?.value || 1);
}

function createKeywordInput(index) {
  const wrapper = document.createElement("div");
  wrapper.className = "flex flex-col gap-1";

  const label = document.createElement("label");
  label.className = "text-sm font-medium text-slate-700";
  label.setAttribute("for", `keyword-${index}`);
  label.textContent = `Parola ${index}`;

  const input = document.createElement("input");
  input.id = `keyword-${index}`;
  input.name = `keyword-${index}`;
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.maxLength = 30;
  input.placeholder = `Inserisci parola ${index}`;
  input.className = "keyword-input";

  wrapper.append(label, input);
  return wrapper;
}

function renderKeywordInputs(count) {
  const safeCount = Math.max(MIN_KEYWORDS, Math.min(MAX_KEYWORDS, count));
  keywordsContainer.innerHTML = "";

  for (let i = 1; i <= safeCount; i += 1) {
    keywordsContainer.append(createKeywordInput(i));
  }

  const firstInput = keywordsContainer.querySelector("input");
  firstInput?.focus();
}

function showInputError(message) {
  inputError.textContent = message;
  inputError.classList.remove("hidden");
}

function clearInputError() {
  inputError.textContent = "";
  inputError.classList.add("hidden");

  keywordsContainer.querySelectorAll("input").forEach((input) => {
    input.classList.remove("invalid");
  });
}

function collectKeywords() {
  clearInputError();

  const inputs = Array.from(keywordsContainer.querySelectorAll("input"));
  const keywords = [];

  for (const input of inputs) {
    const value = input.value.trim();

    if (!value) {
      input.classList.add("invalid");
      showInputError("Compila tutti i campi parola prima di inviare.");
      return null;
    }

    if (/\s/.test(value)) {
      input.classList.add("invalid");
      showInputError("Ogni campo deve contenere una sola parola, senza spazi.");
      return null;
    }

    keywords.push(value);
  }

  const unique = new Set(keywords.map((word) => word.toLowerCase()));
  if (unique.size !== keywords.length) {
    showInputError(
      "Usa parole diverse tra loro per ottenere una storia migliore.",
    );
    return null;
  }

  return keywords;
}

function updateProgress(value, label) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  loadingBar.style.width = `${safe}%`;
  loadingPercent.textContent = `${safe}%`;
  if (label) {
    loadingLabel.textContent = label;
  }
}

function startProgressAnimation() {
  loadingSection.classList.remove("hidden");
  updateProgress(0, "Preparazione richiesta...");

  let progress = 0;
  const phases = [
    "Preparazione richiesta...",
    "Invio delle parole all'AI...",
    "Composizione della storiella...",
  ];

  progressTimer = setInterval(() => {
    const increment = Math.random() * 8 + 2;
    progress = Math.min(progress + increment, 92);

    const phaseIndex = progress < 35 ? 0 : progress < 70 ? 1 : 2;
    updateProgress(progress, phases[phaseIndex]);
  }, 350);
}

function stopProgressAnimation() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

async function generateStoryWithAI(keywords) {
  const prompt = [
    "Scrivi una storiella breve in italiano (80-140 parole).",
    "Usa TUTTE queste parole chiave in modo naturale: " +
      keywords.join(", ") +
      ".",
    "Tono: creativo ma semplice.",
    "Niente elenco puntato, una singola storia.",
  ].join(" ");

  const body = {
    model: "openai",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.9,
    max_tokens: 240,
  };

  const response = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Errore API (${response.status})`);
  }

  const data = await response.json();
  const story = data?.choices?.[0]?.message?.content?.trim();

  if (!story) {
    throw new Error("Risposta AI non valida.");
  }

  return story;
}

function showStory(story) {
  currentStory = story;
  storyOutput.textContent = story;

  const words = story.split(/\s+/).filter(Boolean).length;
  wordCounter.textContent = `${words} parole`;
  resultSection.classList.remove("hidden");
}

function sanitizeForFilename(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function downloadStoryAsTxt() {
  if (!currentStory) {
    return;
  }

  const now = new Date();
  const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const firstWord = sanitizeForFilename(
    currentStory.split(/\s+/)[0] || "storia",
  );
  const filename = `storia-${firstWord || "ai"}-${datePart}.txt`;

  const blob = new Blob([currentStory], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

async function copyStory() {
  if (!currentStory) {
    return;
  }

  try {
    await navigator.clipboard.writeText(currentStory);
    copyBtn.textContent = "Copiato!";
    setTimeout(() => {
      copyBtn.textContent = "Copia testo";
    }, 1400);
  } catch {
    copyBtn.textContent = "Copia non riuscita";
    setTimeout(() => {
      copyBtn.textContent = "Copia testo";
    }, 1400);
  }
}

function setBusyState(isBusy) {
  submitBtn.disabled = isBusy;
  submitBtn.classList.toggle("opacity-70", isBusy);
  submitBtn.classList.toggle("cursor-not-allowed", isBusy);
}

function hardReset() {
  stopProgressAnimation();
  currentStory = "";

  form.reset();
  const defaultRadio = keywordCountGroup.querySelector('input[value="1"]');
  if (defaultRadio) {
    defaultRadio.checked = true;
  }

  clearInputError();
  renderKeywordInputs(1);

  loadingSection.classList.add("hidden");
  updateProgress(0, "Preparazione richiesta...");

  resultSection.classList.add("hidden");
  storyOutput.textContent = "";
  wordCounter.textContent = "";
}

keywordCountGroup.addEventListener("change", () => {
  renderKeywordInputs(getSelectedCount());
  clearInputError();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const keywords = collectKeywords();
  if (!keywords) {
    return;
  }

  setBusyState(true);
  resultSection.classList.add("hidden");
  startProgressAnimation();

  try {
    const story = await generateStoryWithAI(keywords);

    stopProgressAnimation();
    updateProgress(100, "Completato");

    showStory(story);
  } catch (error) {
    stopProgressAnimation();
    loadingSection.classList.add("hidden");
    showInputError("Impossibile generare la storia ora. Riprova tra poco.");
    console.error(error);
  } finally {
    setBusyState(false);
  }
});

resetBtn.addEventListener("click", hardReset);
downloadBtn.addEventListener("click", downloadStoryAsTxt);
copyBtn.addEventListener("click", copyStory);

renderKeywordInputs(1);
