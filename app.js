import { generateSecret, scoreGuess, validateGuess } from "./src/gameLogic.js";
import { createInitialState, resetGuesses } from "./src/state.js";
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
  modal: document.querySelector("#modal"),
  modalOpen: document.querySelector("#how-to"),
  modalClose: document.querySelector("#modal-close"),
};

const paletteMap = new Map(PALETTE.map((color) => [color.id, color]));

let state = createInitialState(DEFAULT_OPTIONS);
let boardRows = [];
let eraseMode = false;
let activePickerSlot = null;
let soundEnabled = false;
let audioContext = null;

const SOUND_PRESETS = {
  place: { frequency: 520, duration: 0.12, type: "triangle", gain: 0.18 },
  erase: { frequency: 260, duration: 0.1, type: "sine", gain: 0.16 },
  select: { frequency: 360, duration: 0.08, type: "square", gain: 0.12 },
  submit: { frequency: 610, duration: 0.18, type: "triangle", gain: 0.2 },
  win: { frequency: 820, duration: 0.3, type: "sine", gain: 0.24 },
  lose: { frequency: 200, duration: 0.28, type: "sawtooth", gain: 0.2 },
  start: { frequency: 480, duration: 0.16, type: "sine", gain: 0.18 },
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

function updateSoundLabel() {
  if (!elements.soundLabel) {
    return;
  }
  elements.soundLabel.textContent = soundEnabled ? "Sound (on)" : "Sound (off)";
}

const colorPicker = document.createElement("select");
colorPicker.id = "color-picker";
colorPicker.className = "color-picker";
colorPicker.setAttribute("aria-label", "Pick a color");
document.body.appendChild(colorPicker);

function populateColorPicker() {
  colorPicker.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Pick a color";
  placeholder.disabled = true;
  placeholder.selected = true;
  colorPicker.appendChild(placeholder);

  PALETTE.slice(0, state.options.paletteSize).forEach((color) => {
    const option = document.createElement("option");
    option.value = color.id;
    option.textContent = color.name;
    colorPicker.appendChild(option);
  });
}

function hideColorPicker() {
  colorPicker.style.display = "none";
  activePickerSlot = null;
}

function openColorPicker(slot, rowIndex, colIndex) {
  activePickerSlot = { rowIndex, colIndex };
  populateColorPicker();
  const rect = slot.getBoundingClientRect();
  const pickerWidth = 220;
  const pickerHeight = 48;
  const left = Math.min(Math.max(rect.left, 12), window.innerWidth - pickerWidth - 12);
  const top = Math.min(rect.bottom + 8, window.innerHeight - pickerHeight - 12);
  colorPicker.style.left = `${left}px`;
  colorPicker.style.top = `${top}px`;
  colorPicker.style.display = "block";
  colorPicker.focus();
}

function shouldUseDropdown() {
  return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 640px)").matches;
}

function syncSubmitButton() {
  const currentGuess = state.guesses[state.currentRow];
  elements.submit.disabled = !currentGuess || currentGuess.includes(null);
}

function updateBoard() {
  boardRows.forEach((rowElements, index) => {
    renderRowGuess(rowElements, state.guesses[index], paletteMap, index === state.currentRow);
    renderFeedback(rowElements, state.feedback[index]);
  });
  syncSubmitButton();
}

function startNewGame() {
  state.options = {
    ...state.options,
    codeLength: Number(elements.codeLength.value),
    paletteSize: Number(elements.paletteSize.value),
    allowDuplicates: elements.allowDuplicates.checked,
  };

  resetGuesses(state);
  state.selectedColor = PALETTE[0].id;
  eraseMode = false;

  state.secret = generateSecret({
    length: state.options.codeLength,
    paletteSize: state.options.paletteSize,
    allowDuplicates: state.options.allowDuplicates,
    palette: PALETTE.map((color) => color.id),
  });

  boardRows = createBoard(elements.board, state.options.maxRows, state.options.codeLength);
  renderPalette(elements.palette, PALETTE, state.options.paletteSize, 0);
  populateColorPicker();
  hideColorPicker();
  elements.statusMessage.textContent = "";
  elements.reveal.innerHTML = "";
  updateBoard();
  playSound("start");
}

function setSelectedColor(index) {
  state.selectedColor = PALETTE[index]?.id ?? null;
  renderPalette(elements.palette, PALETTE, state.options.paletteSize, index);
  if (state.selectedColor) {
    playSound("select");
  }
}

function updateSlot(rowIndex, colIndex, value) {
  const previousValue = state.guesses[rowIndex][colIndex];
  state.guesses[rowIndex][colIndex] = value;
  state.activeSlot = colIndex;
  elements.statusMessage.textContent = "";
  updateBoard();
  if (value && value !== previousValue) {
    playSound("place");
  }
  if (!value && previousValue) {
    playSound("erase");
  }
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
    updateSlot(rowIndex, colIndex, null);
    return;
  }

  if (shouldUseDropdown()) {
    openColorPicker(slot, rowIndex, colIndex);
    return;
  }

  if (!state.selectedColor) {
    return;
  }

  updateSlot(rowIndex, colIndex, state.selectedColor);
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
    return;
  }

  if (state.currentRow === state.options.maxRows - 1) {
    state.status = "lost";
    elements.statusMessage.textContent = "No more turns. The code was:";
    renderReveal(elements.reveal, state.secret, paletteMap);
    elements.submit.disabled = true;
    playSound("lose");
    return;
  }

  state.currentRow += 1;
  state.activeSlot = 0;
  elements.statusMessage.textContent = "";
  updateBoard();
}

function handlePaletteClick(event) {
  const option = event.target.closest(".palette__option");
  if (!option) {
    return;
  }
  setSelectedColor(Number(option.dataset.index));
}

function toggleErase() {
  eraseMode = !eraseMode;
  elements.erase.classList.toggle("button--ghost", !eraseMode);
  elements.erase.textContent = eraseMode ? "Erase On" : "Erase";
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
    setSelectedColor(index);
    if (state.guesses[state.currentRow][state.activeSlot] === null) {
      updateSlot(state.currentRow, state.activeSlot, PALETTE[index].id);
      if (state.activeSlot < state.options.codeLength - 1) {
        state.activeSlot += 1;
      }
    }
    return;
  }

  if (event.key === "ArrowLeft") {
    state.activeSlot = Math.max(0, state.activeSlot - 1);
  }
  if (event.key === "ArrowRight") {
    state.activeSlot = Math.min(state.options.codeLength - 1, state.activeSlot + 1);
  }
  if (event.key === "Backspace") {
    updateSlot(state.currentRow, state.activeSlot, null);
  }
}

function wireEvents() {
  elements.board.addEventListener("click", handleSlotClick);
  elements.board.addEventListener("contextmenu", handleSlotRightClick);
  elements.palette.addEventListener("click", handlePaletteClick);
  colorPicker.addEventListener("change", (event) => {
    const value = event.target.value;
    if (!value || !activePickerSlot) {
      hideColorPicker();
      return;
    }
    const index = PALETTE.findIndex((color) => color.id === value);
    if (index >= 0) {
      setSelectedColor(index);
    }
    updateSlot(activePickerSlot.rowIndex, activePickerSlot.colIndex, value);
    hideColorPicker();
  });
  colorPicker.addEventListener("blur", hideColorPicker);
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
  window.addEventListener("resize", hideColorPicker);
  window.addEventListener("scroll", hideColorPicker, true);
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
}

wireEvents();
updateSoundLabel();
startNewGame();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
