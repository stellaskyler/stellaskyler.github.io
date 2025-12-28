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
  modal: document.querySelector("#modal"),
  modalOpen: document.querySelector("#how-to"),
  modalClose: document.querySelector("#modal-close"),
};

const paletteMap = new Map(PALETTE.map((color) => [color.id, color]));

let state = createInitialState(DEFAULT_OPTIONS);
let boardRows = [];
let eraseMode = false;

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
  elements.statusMessage.textContent = "";
  elements.reveal.innerHTML = "";
  updateBoard();
}

function setSelectedColor(index) {
  state.selectedColor = PALETTE[index]?.id ?? null;
  renderPalette(elements.palette, PALETTE, state.options.paletteSize, index);
}

function updateSlot(rowIndex, colIndex, value) {
  state.guesses[rowIndex][colIndex] = value;
  state.activeSlot = colIndex;
  updateBoard();
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

  const feedback = scoreGuess(state.secret, currentGuess);
  state.feedback[state.currentRow] = feedback;
  updateBoard();

  if (feedback.blacks === state.options.codeLength) {
    state.status = "won";
    elements.statusMessage.textContent = "You cracked the code!";
    renderReveal(elements.reveal, state.secret, paletteMap);
    elements.submit.disabled = true;
    return;
  }

  if (state.currentRow === state.options.maxRows - 1) {
    state.status = "lost";
    elements.statusMessage.textContent = "No more turns. The code was:";
    renderReveal(elements.reveal, state.secret, paletteMap);
    elements.submit.disabled = true;
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
    elements.soundToggle.checked = false;
  });
}

wireEvents();
startNewGame();
