const form = document.querySelector("#story-form");
const keywordsContainer = document.querySelector("#keywords-container");
const addKeywordBtn = document.querySelector("#add-keyword-btn");
const removeKeywordBtn = document.querySelector("#remove-keyword-btn");
const keywordCountLabel = document.querySelector("#keyword-count-label");
const responseTypeSelect = document.querySelector("#response-type");
const inputError = document.querySelector("#input-error");
const submitBtn = document.querySelector("#submit-btn");
const resetBtn = document.querySelector("#reset-btn");
const chooseFolderMainBtn = document.querySelector("#choose-folder-main-btn");
const folderStatusMain = document.querySelector("#folder-status-main");

const loadingSection = document.querySelector("#loading-section");
const loadingLabel = document.querySelector("#loading-label");
const loadingPercent = document.querySelector("#loading-percent");
const loadingBar = document.querySelector("#loading-bar");

const resultSection = document.querySelector("#result-section");
const resultTitle = document.querySelector("#result-title");
const storyOutput = document.querySelector("#story-output");
const wordCounter = document.querySelector("#word-counter");
const downloadBtn = document.querySelector("#download-btn");
const copyBtn = document.querySelector("#copy-btn");

const toggleLibraryBtn = document.querySelector("#toggle-library-btn");
const libraryPanel = document.querySelector("#library-panel");
const closeLibraryBtn = document.querySelector("#close-library-btn");
const refreshLibraryBtn = document.querySelector("#refresh-library-btn");
const connectFolderBtn = document.querySelector("#connect-folder-btn");
const folderInput = document.querySelector("#folder-input");
const libraryStatus = document.querySelector("#library-status");
const txtList = document.querySelector("#txt-list");
const archiveFileName = document.querySelector("#archive-file-name");
const archiveStoryOutput = document.querySelector("#archive-story-output");

const MAX_KEYWORDS = 5;
const MIN_KEYWORDS = 1;
const SUPPORTS_FS_ACCESS = "showDirectoryPicker" in window;
const CONFIG_DB_NAME = "story-generator-config-db";
const CONFIG_STORE_NAME = "settings";
const DIR_HANDLE_KEY = "archiveDirHandle";
const UI_CONFIG_KEY = "story-ui-config";
let currentStory = "";
let currentKeywords = [];
let keywordCount = MIN_KEYWORDS;
let progressTimer = null;
let linkedTxtFiles = [];
let archiveDirectoryHandle = null;
let mainStatusTimer = null;
let activeArchiveFilePath = "";

function getResultTitleByType(responseType) {
  const titles = {
    storiella: "La tua storiella",
    poesia: "La tua poesia",
    aforisma: "I tuoi aforismi",
    favola: "La tua favola breve",
  };

  return titles[responseType] || titles.storiella;
}

function updateResultTitle(responseType) {
  if (!resultTitle) {
    return;
  }

  resultTitle.textContent = getResultTitleByType(responseType);
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

function renderKeywordInputs(
  count = keywordCount,
  preservedValues = [],
  focusIndex = null,
) {
  keywordCount = Math.max(MIN_KEYWORDS, Math.min(MAX_KEYWORDS, count));
  keywordsContainer.innerHTML = "";

  for (let i = 1; i <= keywordCount; i += 1) {
    const inputWrapper = createKeywordInput(i);
    const input = inputWrapper.querySelector("input");
    if (input && typeof preservedValues[i - 1] === "string") {
      input.value = preservedValues[i - 1];
    }
    keywordsContainer.append(inputWrapper);
  }

  keywordCountLabel.textContent = `${keywordCount} / ${MAX_KEYWORDS}`;
  addKeywordBtn.disabled = keywordCount >= MAX_KEYWORDS;
  removeKeywordBtn.disabled = keywordCount <= MIN_KEYWORDS;
  addKeywordBtn.classList.toggle("opacity-50", addKeywordBtn.disabled);
  removeKeywordBtn.classList.toggle("opacity-50", removeKeywordBtn.disabled);

  const nextFocusIndex =
    focusIndex === null
      ? 0
      : Math.max(0, Math.min(keywordCount - 1, Number(focusIndex)));
  const focusInput = keywordsContainer.querySelector(
    `#keyword-${nextFocusIndex + 1}`,
  );
  if (focusInput instanceof HTMLInputElement) {
    focusInput.focus();
  }
}

function getCurrentKeywordValues() {
  return Array.from(keywordsContainer.querySelectorAll("input")).map(
    (input) => input.value,
  );
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
    "Composizione dell'opera'...",
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

function setLibraryOpen(isOpen) {
  libraryPanel.classList.toggle("library-collapsed", !isOpen);
  toggleLibraryBtn.textContent = isOpen
    ? "Nascondi archivio .txt"
    : "Mostra archivio .txt";
  toggleLibraryBtn.setAttribute("aria-expanded", String(isOpen));
  saveUiConfig({ libraryOpen: isOpen });
}

function updateLibraryStatus(message, isError = false) {
  libraryStatus.textContent = message;
  libraryStatus.title = message || "";
  libraryStatus.classList.toggle("text-red-600", isError);
  libraryStatus.classList.toggle("text-slate-500", !isError);
}

function updateMainFolderStatus(message, isError = false, autoHideMs = 0) {
  if (mainStatusTimer) {
    clearTimeout(mainStatusTimer);
    mainStatusTimer = null;
  }

  folderStatusMain.textContent = message;
  folderStatusMain.classList.toggle("text-red-600", isError);
  folderStatusMain.classList.toggle("text-slate-500", !isError);

  if (autoHideMs > 0 && message) {
    mainStatusTimer = setTimeout(() => {
      folderStatusMain.textContent = "";
      folderStatusMain.classList.remove("text-red-600");
      folderStatusMain.classList.add("text-slate-500");
    }, autoHideMs);
  }
}

function renderTxtList() {
  txtList.innerHTML = "";

  if (!linkedTxtFiles.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "text-sm text-slate-500";
    emptyItem.textContent =
      "Nessun file .txt trovato nella cartella selezionata.";
    txtList.append(emptyItem);
    return;
  }

  linkedTxtFiles.forEach((entry, index) => {
    const listItem = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      entry.path === activeArchiveFilePath
        ? "txt-item txt-item-active"
        : "txt-item";
    button.textContent = entry.path;
    button.dataset.fileIndex = String(index);
    listItem.append(button);
    txtList.append(listItem);
  });
}

function showArchiveStory(text, fileLabel) {
  archiveStoryOutput.textContent = text;
  archiveFileName.textContent = fileLabel || "Nessun file aperto.";
}

async function generateStoryWithAI(keywords, responseType) {
  const responseTypeInstructions = {
    storiella:
      "Scrivi una storiella breve in italiano (80-140 parole), in forma narrativa.",
    poesia:
      "Scrivi una poesia breve in italiano (8-14 versi), stile semplice e creativo.",
    aforisma:
      "Scrivi 3 aforismi brevi in italiano usando tutte le parole in modo naturale.",
    favola:
      "Scrivi una favola breve in italiano (90-150 parole) con tono leggero.",
  };

  const typePrompt =
    responseTypeInstructions[responseType] ||
    responseTypeInstructions.storiella;

  const prompt = [
    typePrompt,
    "Usa TUTTE queste parole chiave in modo naturale: " +
      keywords.join(", ") +
      ".",
    "Tono: creativo ma semplice.",
    "Niente spiegazioni extra: solo il testo richiesto.",
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
    credentials: "omit",
    referrerPolicy: "no-referrer",
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

function buildStoryFilename() {
  const now = new Date();
  const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
  const promptWordsPart = currentKeywords
    .map((word) => sanitizeForFilename(word))
    .filter(Boolean)
    .join("-");

  return `storia-${promptWordsPart || "ai"}-${datePart}.txt`;
}

function downloadStoryAsTxtFallback(filename) {
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

async function downloadStoryAsTxt() {
  if (!currentStory) {
    return;
  }

  const filename = buildStoryFilename();

  if (archiveDirectoryHandle) {
    try {
      const canWrite = await ensureDirectoryPermission(
        archiveDirectoryHandle,
        "readwrite",
        false,
      );

      if (canWrite) {
        const fileHandle = await archiveDirectoryHandle.getFileHandle(
          filename,
          {
            create: true,
          },
        );
        const writable = await fileHandle.createWritable();
        await writable.write(currentStory);
        await writable.close();

        updateMainFolderStatus(
          `File salvato in cartella collegata: ${filename}`,
        );
        updateLibraryStatus(`Nuovo file salvato: ${filename}`);
        await refreshTxtLibrary(false);
        return;
      }
    } catch (error) {
      console.error(error);
    }
  }

  downloadStoryAsTxtFallback(filename);
  updateMainFolderStatus(
    "Download browser usato (nessuna cartella scrivibile collegata).",
  );
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
  currentKeywords = [];
  keywordCount = MIN_KEYWORDS;

  form.reset();
  clearInputError();
  renderKeywordInputs(1);

  loadingSection.classList.add("hidden");
  updateProgress(0, "Preparazione richiesta...");

  resultSection.classList.add("hidden");
  updateResultTitle(responseTypeSelect?.value || "storiella");
  storyOutput.textContent = "";
  wordCounter.textContent = "";
}

function openConfigDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONFIG_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CONFIG_STORE_NAME)) {
        db.createObjectStore(CONFIG_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key) {
  const db = await openConfigDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONFIG_STORE_NAME, "readonly");
    const store = tx.objectStore(CONFIG_STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openConfigDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONFIG_STORE_NAME, "readwrite");
    const store = tx.objectStore(CONFIG_STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function ensureDirectoryPermission(
  handle,
  mode = "read",
  request = false,
) {
  if (!handle) {
    return false;
  }

  const options = { mode };

  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }

  if (!request) {
    return false;
  }

  return (await handle.requestPermission(options)) === "granted";
}

async function saveArchiveDirectoryHandle(handle) {
  await idbSet(DIR_HANDLE_KEY, handle);
}

async function loadArchiveDirectoryHandle() {
  return idbGet(DIR_HANDLE_KEY);
}

function saveUiConfig(config) {
  const current = loadUiConfig();
  const merged = { ...current, ...config };
  localStorage.setItem(UI_CONFIG_KEY, JSON.stringify(merged));
}

function loadUiConfig() {
  try {
    return JSON.parse(localStorage.getItem(UI_CONFIG_KEY) || "{}");
  } catch {
    return {};
  }
}

async function listTxtFilesInDirectory(dirHandle, prefix = "") {
  const files = [];

  for await (const [name, handle] of dirHandle.entries()) {
    const currentPath = prefix ? `${prefix}/${name}` : name;

    if (handle.kind === "file" && name.toLowerCase().endsWith(".txt")) {
      files.push({
        name,
        path: currentPath,
        type: "handle",
        handle,
      });
      continue;
    }

    if (handle.kind === "directory") {
      const nested = await listTxtFilesInDirectory(handle, currentPath);
      files.push(...nested);
    }
  }

  return files;
}

function loadTxtFilesFromInput(fileList) {
  linkedTxtFiles = Array.from(fileList)
    .filter((file) => file.name.toLowerCase().endsWith(".txt"))
    .map((file) => ({
      name: file.name,
      path: file.webkitRelativePath || file.name,
      type: "input-file",
      file,
    }))
    .sort((first, second) => first.path.localeCompare(second.path, "it"));

  if (linkedTxtFiles.length) {
    updateLibraryStatus(`File .txt trovati: ${linkedTxtFiles.length}`);
  } else {
    updateLibraryStatus("Cartella collegata, ma non contiene file .txt.", true);
  }

  if (!linkedTxtFiles.some((entry) => entry.path === activeArchiveFilePath)) {
    activeArchiveFilePath = "";
    showArchiveStory("", "Nessun file aperto.");
  }

  renderTxtList();
}

async function refreshTxtLibrary(showErrors = true) {
  if (!archiveDirectoryHandle) {
    linkedTxtFiles = [];
    renderTxtList();
    updateLibraryStatus("Nessuna cartella collegata.");
    return;
  }

  try {
    const canRead = await ensureDirectoryPermission(
      archiveDirectoryHandle,
      "read",
      false,
    );

    if (!canRead) {
      if (showErrors) {
        updateLibraryStatus(
          "Permesso lettura non disponibile. Ricollega la cartella.",
          true,
        );
      }
      return;
    }

    linkedTxtFiles = await listTxtFilesInDirectory(archiveDirectoryHandle);
    linkedTxtFiles.sort((first, second) =>
      first.path.localeCompare(second.path, "it"),
    );

    if (linkedTxtFiles.length) {
      updateLibraryStatus(`File .txt trovati: ${linkedTxtFiles.length}`);
    } else {
      updateLibraryStatus(
        "Cartella collegata, ma non contiene file .txt.",
        true,
      );
    }

    if (!linkedTxtFiles.some((entry) => entry.path === activeArchiveFilePath)) {
      activeArchiveFilePath = "";
      showArchiveStory("", "Nessun file aperto.");
    }

    renderTxtList();
  } catch (error) {
    if (showErrors) {
      updateLibraryStatus("Errore durante la scansione della cartella.", true);
    }
    console.error(error);
  }
}

async function connectUnifiedFolder() {
  if (!SUPPORTS_FS_ACCESS) {
    folderInput.click();
    updateMainFolderStatus(
      "Browser senza File System Access API: usa selezione cartella manuale.",
    );
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    const canRead = await ensureDirectoryPermission(handle, "read", true);
    if (!canRead) {
      updateMainFolderStatus("Permesso lettura cartella non concesso.", true);
      return;
    }

    archiveDirectoryHandle = handle;
    await saveArchiveDirectoryHandle(handle);

    const canWrite = await ensureDirectoryPermission(handle, "readwrite", true);

    updateMainFolderStatus(
      canWrite
        ? `Cartella collegata: ${handle.name}`
        : `Cartella collegata in sola lettura: ${handle.name}`,
      false,
    );

    setLibraryOpen(true);
    await refreshTxtLibrary();
  } catch (error) {
    updateMainFolderStatus("Collegamento cartella annullato.", false, 3000);
    console.error(error);
  }
}

async function openTxtStory(fileIndex) {
  const item = linkedTxtFiles[fileIndex];
  if (!item) {
    return;
  }

  const file = item.type === "handle" ? await item.handle.getFile() : item.file;
  const content = (await file.text()).trim();

  if (!content) {
    updateLibraryStatus(`Il file ${item.name} è vuoto.`, true);
    return;
  }

  activeArchiveFilePath = item.path;
  renderTxtList();
  showArchiveStory(content, item.path);
  updateLibraryStatus(`Aperto: ${item.path}`);
}

addKeywordBtn.addEventListener("click", () => {
  if (keywordCount >= MAX_KEYWORDS) {
    return;
  }

  const preservedValues = getCurrentKeywordValues();
  renderKeywordInputs(keywordCount + 1, preservedValues, keywordCount);
  clearInputError();
});

removeKeywordBtn.addEventListener("click", () => {
  if (keywordCount <= MIN_KEYWORDS) {
    return;
  }

  const preservedValues = getCurrentKeywordValues().slice(0, keywordCount - 1);
  renderKeywordInputs(keywordCount - 1, preservedValues, keywordCount - 2);
  clearInputError();
});

toggleLibraryBtn.addEventListener("click", () => {
  const isOpen = libraryPanel.classList.contains("library-collapsed");
  setLibraryOpen(isOpen);
});

closeLibraryBtn.addEventListener("click", () => {
  setLibraryOpen(false);
});

refreshLibraryBtn.addEventListener("click", () => {
  void refreshTxtLibrary();
});

connectFolderBtn.addEventListener("click", () => {
  void connectUnifiedFolder();
});

chooseFolderMainBtn.addEventListener("click", () => {
  void connectUnifiedFolder();
});

responseTypeSelect?.addEventListener("change", () => {
  updateResultTitle(responseTypeSelect.value);
});

folderInput.addEventListener("change", () => {
  if (!folderInput.files || !folderInput.files.length) {
    return;
  }

  loadTxtFilesFromInput(folderInput.files);
  updateMainFolderStatus(
    "Cartella collegata in modalità manuale (sola lettura).",
    false,
  );
  setLibraryOpen(true);
});

txtList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const index = Number(target.dataset.fileIndex);
  if (Number.isNaN(index)) {
    return;
  }

  try {
    await openTxtStory(index);
  } catch (error) {
    updateLibraryStatus("Impossibile leggere il file selezionato.", true);
    console.error(error);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const keywords = collectKeywords();
  if (!keywords) {
    return;
  }

  currentKeywords = [...keywords];
  const responseType = responseTypeSelect?.value || "storiella";
  updateResultTitle(responseType);

  setBusyState(true);
  resultSection.classList.add("hidden");
  startProgressAnimation();

  try {
    const story = await generateStoryWithAI(keywords, responseType);

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
downloadBtn.addEventListener("click", () => {
  void downloadStoryAsTxt();
});
copyBtn.addEventListener("click", copyStory);

async function init() {
  renderKeywordInputs(1);
  renderTxtList();
  showArchiveStory("", "Nessun file aperto.");
  updateMainFolderStatus("Nessuna cartella collegata.");
  updateResultTitle(responseTypeSelect?.value || "storiella");

  const uiConfig = loadUiConfig();
  setLibraryOpen(Boolean(uiConfig.libraryOpen));

  if (!SUPPORTS_FS_ACCESS) {
    updateLibraryStatus(
      "Browser senza File System Access API: usa la selezione manuale cartella.",
      false,
    );
    return;
  }

  try {
    const storedHandle = await loadArchiveDirectoryHandle();
    if (!storedHandle) {
      return;
    }

    archiveDirectoryHandle = storedHandle;
    const canRead = await ensureDirectoryPermission(
      archiveDirectoryHandle,
      "read",
      false,
    );

    if (!canRead) {
      updateMainFolderStatus(
        "Cartella salvata trovata, ma serve ricollegarla per i permessi.",
        false,
      );
      return;
    }

    const canWrite = await ensureDirectoryPermission(
      archiveDirectoryHandle,
      "readwrite",
      false,
    );

    updateMainFolderStatus(
      canWrite
        ? `Cartella caricata: ${archiveDirectoryHandle.name}`
        : `Cartella caricata (sola lettura): ${archiveDirectoryHandle.name}`,
    );

    await refreshTxtLibrary();
  } catch (error) {
    console.error(error);
  }
}

void init();
