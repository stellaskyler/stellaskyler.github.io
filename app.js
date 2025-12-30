import { generateSecret, scoreGuess, validateGuess } from "./src/gameLogic.js";
import {
  createInitialState,
  hydrateState,
  resetGuesses,
  serializeState,
} from "./src/state.js";
import {
  closeModal,
  createBoard,
  openModal,
  renderFeedback,
  renderPalette,
  renderReveal,
  renderRowGuess,
} from "./src/ui.js";

const PALETTE = [
  { id: "red", name: "Red", hex: "#ef4444", symbol: "R" },
  { id: "blue", name: "Blue", hex: "#3b82f6", symbol: "B" },
  { id: "green", name: "Green", hex: "#22c55e", symbol: "G" },
  { id: "yellow", name: "Yellow", hex: "#facc15", symbol: "Y" },
  { id: "purple", name: "Purple", hex: "#a855f7", symbol: "P" },
  { id: "orange", name: "Orange", hex: "#f97316", symbol: "O" },
  { id: "teal", name: "Teal", hex: "#14b8a6", symbol: "T" },
  { id: "pink", name: "Pink", hex: "#ec4899", symbol: "K" },
];

const DEFAULT_OPTIONS = {
  codeLength: 4,
  paletteSize: 6,
  allowDuplicates: true,
  maxRows: 10,
};

const elements = {
  board: document.querySelector("#board"),
  palette: document.querySelector("#palette"),
  submit: document.querySelector("#submit"),
  erase: document.querySelector("#erase"),
  newGame: document.querySelector("#new-game"),
  reveal: document.querySelector("#reveal-pegs"),
  statusMessage: document.querySelector("#status-message"),
  codeLength: document.querySelector("#code-length"),
  paletteSize: document.querySelector("#palette-size"),
  allowDuplicates: document.querySelector("#allow-duplicates"),
  soundToggle: document.querySelector("#sound-toggle"),
  soundLabel: document.querySelector("#sound-label"),
  hapticsToggle: document.querySelector("#haptics-toggle"),
  hapticsLabel: document.querySelector("#haptics-label"),
  modal: document.querySelector("#modal"),
  modalOpen: document.querySelector("#how-to"),
  modalClose: document.querySelector("#modal-close"),
};

const paletteMap = new Map(PALETTE.map((color) => [color.id, color]));

let state = createInitialState(DEFAULT_OPTIONS);
let boardRows = [];
let eraseMode = false;
let soundEnabled = false;
let hapticsEnabled = false;
let audioContext = null;
let hintTimeout = null;
const STORAGE_KEY = "mastermind-state";
const HAPTICS_STORAGE_KEY = "mastermind-haptics-enabled";

const SOUND_PRESETS = {
  place: { frequency: 520, duration: 0.12, type: "triangle", gain: 0.18 },
  erase: { frequency: 260, duration: 0.1, type: "sine", gain: 0.16 },
  select: { frequency: 360, duration: 0.08, type: "square", gain: 0.12 },
  submit: { frequency: 610, duration: 0.18, type: "triangle", gain: 0.2 },
  win: { frequency: 820, duration: 0.3, type: "sine", gain: 0.24 },
  lose: { frequency: 200, duration: 0.28, type: "sawtooth", gain: 0.2 },
  start: { frequency: 480, duration: 0.16, type: "sine", gain: 0.18 },
};

const HAPTIC_PRESETS = {
  place: 20,
  erase: 15,
};

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playSound(name) {
  if (!soundEnabled) {
    return;
  }
  const preset = SOUND_PRESETS[name];
  if (!preset) {
    return;
  }
  ensureAudioContext();
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = preset.type;
  oscillator.frequency.setValueAtTime(preset.frequency, now);
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(preset.gain, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + preset.duration);

  oscillator.connect(gainNode).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + preset.duration + 0.05);
}

function triggerHaptics(name) {
  if (!hapticsEnabled || !("vibrate" in navigator)) {
    return;
  }
  const pattern = HAPTIC_PRESETS[name];
  if (!pattern) {
    return;
  }
  navigator.vibrate(pattern);
}

function updateSoundLabel() {
  if (!elements.soundLabel) {
    return;
  }
  elements.soundLabel.textContent = soundEnabled ? "Sound (on)" : "Sound (off)";
}

function updateHapticsLabel() {
  if (!elements.hapticsLabel) {
    return;
  }
  elements.hapticsLabel.textContent = hapticsEnabled ? "Haptics (on)" : "Haptics (off)";
}

function getFirstEmptyIndex(guess) {
  const index = guess.indexOf(null);
  return index === -1 ? null : index;
}

function updateNextFillIndex() {
  state.nextFillIndex = getFirstEmptyIndex(state.guesses[state.currentRow]);
}

function getDisabledColors() {
  if (state.options.allowDuplicates) {
    return new Set();
  }
  return new Set(state.guesses[state.currentRow].filter(Boolean));
}

function showHint(message) {
  if (state.status !== "playing") {
    return;
  }
  if (hintTimeout) {
    clearTimeout(hintTimeout);
  }
  elements.statusMessage.textContent = message;
  hintTimeout = window.setTimeout(() => {
    if (state.status === "playing") {
      elements.statusMessage.textContent = "";
    }
  }, 1600);
}

function syncSubmitButton() {
  const currentGuess = state.guesses[state.currentRow];
  elements.submit.disabled = !currentGuess || currentGuess.includes(null);
}

function updateBoard() {
  boardRows.forEach((rowElements, index) => {
    renderRowGuess(
      rowElements,
      state.guesses[index],
      paletteMap,
      index === state.currentRow,
      index === state.currentRow ? state.editIndex : null,
    );
    renderFeedback(rowElements, state.feedback[index]);
  });
  renderPalette(elements.palette, PALETTE, state.options.paletteSize, getDisabledColors());
  syncSubmitButton();
}

function saveState() {
  const payload = serializeState(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return null;
  }
  try {
    const parsed = JSON.parse(saved);
    return hydrateState(parsed, DEFAULT_OPTIONS);
  } catch {
    return null;
  }
}

function setEraseMode(enabled) {
  eraseMode = enabled;
  if (eraseMode) {
    state.editIndex = null;
  }
  elements.erase.classList.toggle("button--ghost", !eraseMode);
  elements.erase.textContent = eraseMode ? "Erase On" : "Erase";
  if (boardRows.length) {
    updateBoard();
  }
}

function startNewGame() {
  state.options = {
    ...state.options,
    codeLength: Number(elements.codeLength.value),
    paletteSize: Number(elements.paletteSize.value),
    allowDuplicates: elements.allowDuplicates.checked,
  };

  resetGuesses(state);
  setEraseMode(false);
  updateNextFillIndex();

  state.secret = generateSecret({
    length: state.options.codeLength,
    paletteSize: state.options.paletteSize,
    allowDuplicates: state.options.allowDuplicates,
    palette: PALETTE.map((color) => color.id),
  });

  boardRows = createBoard(elements.board, state.options.maxRows, state.options.codeLength);
  renderPalette(elements.palette, PALETTE, state.options.paletteSize, getDisabledColors());
  elements.statusMessage.textContent = "";
  elements.reveal.innerHTML = "";
  updateBoard();
  playSound("start");
  saveState();
}

function updateSlot(rowIndex, colIndex, value) {
  const previousValue = state.guesses[rowIndex][colIndex];
  state.guesses[rowIndex][colIndex] = value;
  elements.statusMessage.textContent = "";
  updateNextFillIndex();
  updateBoard();
  if (value && value !== previousValue) {
    playSound("place");
  }
  if (!value && previousValue) {
    playSound("erase");
    triggerHaptics("erase");
  }
  saveState();
}

function handleSlotClick(event) {
  const slot = event.target.closest(".peg-slot");
  if (!slot) {
    return;
  }
  const rowIndex = Number(slot.dataset.row);
  const colIndex = Number(slot.dataset.col);
  if (rowIndex !== state.currentRow || state.status !== "playing") {
    return;
  }
  if (eraseMode || event.button === 2) {
    state.editIndex = null;
    updateSlot(rowIndex, colIndex, null);
    return;
  }

  state.editIndex = colIndex;
  updateBoard();
}

function handleSlotRightClick(event) {
  const slot = event.target.closest(".peg-slot");
  if (!slot) {
    return;
  }
  event.preventDefault();
  const rowIndex = Number(slot.dataset.row);
  const colIndex = Number(slot.dataset.col);
  if (rowIndex !== state.currentRow || state.status !== "playing") {
    return;
  }
  state.editIndex = null;
  updateSlot(rowIndex, colIndex, null);
}

function submitGuess() {
  if (state.status !== "playing") {
    return;
  }
  const currentGuess = state.guesses[state.currentRow];
  const validation = validateGuess(currentGuess, {
    length: state.options.codeLength,
    paletteSize: state.options.paletteSize,
    allowDuplicates: state.options.allowDuplicates,
    palette: PALETTE.map((color) => color.id),
  });

  if (!validation.valid) {
    elements.statusMessage.textContent = validation.error;
    return;
  }

  playSound("submit");
  const feedback = scoreGuess(state.secret, currentGuess);
  state.feedback[state.currentRow] = feedback;
  updateBoard();

  if (feedback.blacks === state.options.codeLength) {
    state.status = "won";
    elements.statusMessage.textContent = "You cracked the code!";
    renderReveal(elements.reveal, state.secret, paletteMap);
    elements.submit.disabled = true;
    playSound("win");
    saveState();
    return;
  }

  if (state.currentRow === state.options.maxRows - 1) {
    state.status = "lost";
    elements.statusMessage.textContent = "No more turns. The code was:";
    renderReveal(elements.reveal, state.secret, paletteMap);
    elements.submit.disabled = true;
    playSound("lose");
    saveState();
    return;
  }

  state.currentRow += 1;
  state.editIndex = null;
  updateNextFillIndex();
  elements.statusMessage.textContent = "";
  updateBoard();
  saveState();
}

function handlePaletteClick(event) {
  const option = event.target.closest(".palette__option");
  if (!option) {
    return;
  }
  const color = PALETTE[Number(option.dataset.index)];
  if (!color) {
    return;
  }
  handleColorTap(color.id);
}

function toggleErase() {
  setEraseMode(!eraseMode);
}

function handleColorTap(colorId) {
  if (state.status !== "playing") {
    return;
  }
  if (eraseMode) {
    setEraseMode(false);
  }
  const currentGuess = state.guesses[state.currentRow];
  if (!state.options.allowDuplicates) {
    const usedColors = new Set(currentGuess.filter(Boolean));
    if (state.editIndex === null || currentGuess[state.editIndex] !== colorId) {
      if (usedColors.has(colorId)) {
        showHint("That color is already used.");
        return;
      }
    }
  }

  if (state.editIndex !== null) {
    const targetIndex = state.editIndex;
    state.editIndex = null;
    updateSlot(state.currentRow, targetIndex, colorId);
    triggerHaptics("place");
    return;
  }

  if (state.nextFillIndex === null) {
    showHint("Tap a slot to replace.");
    return;
  }

  updateSlot(state.currentRow, state.nextFillIndex, colorId);
  triggerHaptics("place");
}

function handleKeydown(event) {
  if (elements.modal.classList.contains("is-open")) {
    if (event.key === "Escape") {
      closeModal(elements.modal);
    }
    return;
  }

  if (state.status !== "playing") {
    return;
  }

  const number = Number(event.key);
  if (number >= 1 && number <= state.options.paletteSize) {
    const index = number - 1;
    handleColorTap(PALETTE[index].id);
    return;
  }

  if (event.key === "Backspace") {
    if (state.editIndex !== null) {
      const targetIndex = state.editIndex;
      state.editIndex = null;
      updateSlot(state.currentRow, targetIndex, null);
    } else if (state.nextFillIndex !== null) {
      const previousIndex = Math.max(0, state.nextFillIndex - 1);
      updateSlot(state.currentRow, previousIndex, null);
    }
  }
}

function wireEvents() {
  elements.board.addEventListener("click", handleSlotClick);
  elements.board.addEventListener("contextmenu", handleSlotRightClick);
  elements.palette.addEventListener("click", handlePaletteClick);
  elements.submit.addEventListener("click", submitGuess);
  elements.erase.addEventListener("click", toggleErase);
  elements.newGame.addEventListener("click", startNewGame);
  elements.modalOpen.addEventListener("click", () => openModal(elements.modal));
  elements.modalClose.addEventListener("click", () => closeModal(elements.modal));
  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) {
      closeModal(elements.modal);
    }
  });
  document.addEventListener("keydown", handleKeydown);
  elements.codeLength.addEventListener("change", startNewGame);
  elements.paletteSize.addEventListener("change", startNewGame);
  elements.allowDuplicates.addEventListener("change", startNewGame);
  elements.soundToggle.addEventListener("change", () => {
    soundEnabled = elements.soundToggle.checked;
    if (soundEnabled) {
      ensureAudioContext();
    }
    updateSoundLabel();
  });
  if (elements.hapticsToggle) {
    elements.hapticsToggle.addEventListener("change", () => {
      hapticsEnabled = elements.hapticsToggle.checked;
      localStorage.setItem(HAPTICS_STORAGE_KEY, String(hapticsEnabled));
      updateHapticsLabel();
    });
  }
}

function applyLoadedState(loadedState) {
  state = loadedState;
  elements.codeLength.value = String(state.options.codeLength);
  elements.paletteSize.value = String(state.options.paletteSize);
  elements.allowDuplicates.checked = state.options.allowDuplicates;
  boardRows = createBoard(elements.board, state.options.maxRows, state.options.codeLength);
  elements.statusMessage.textContent = "";
  elements.reveal.innerHTML = "";
  updateNextFillIndex();
  updateBoard();
}

function initializeGame() {
  const storedHaptics = localStorage.getItem(HAPTICS_STORAGE_KEY);
  hapticsEnabled = storedHaptics === "true";
  if (elements.hapticsToggle) {
    elements.hapticsToggle.checked = hapticsEnabled;
  }
  updateHapticsLabel();
  const loadedState = loadState();
  if (loadedState) {
    applyLoadedState(loadedState);
    return;
  }
  state = createInitialState(DEFAULT_OPTIONS);
  startNewGame();
}

wireEvents();
updateSoundLabel();
initializeGame();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
