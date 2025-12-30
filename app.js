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
  soundEnabled: false,
  hapticsEnabled: false,
  timerEnabled: false,
  timerSeconds: 300,
  highContrast: false,
  largeText: false,
  reducedMotion: false,
};

const elements = {
  headerActions: document.querySelector("#header-actions"),
  navHome: document.querySelector("#nav-home"),
  screenHome: document.querySelector("#screen-home"),
  screenGame: document.querySelector("#screen-game"),
  screenSettings: document.querySelector("#screen-settings"),
  screenStats: document.querySelector("#screen-stats"),
  resumeGame: document.querySelector("#resume-game"),
  homeNewGame: document.querySelector("#home-new-game"),
  openSettings: document.querySelector("#open-settings"),
  openStats: document.querySelector("#open-stats"),
  resumeStatus: document.querySelector("#resume-status"),
  board: document.querySelector("#board"),
  palette: document.querySelector("#palette"),
  submit: document.querySelector("#submit"),
  erase: document.querySelector("#erase"),
  newGame: document.querySelector("#new-game"),
  timerValue: document.querySelector("#timer-value"),
  rowCounter: document.querySelector("#row-counter"),
  reveal: document.querySelector("#reveal-pegs"),
  statusMessage: document.querySelector("#status-message"),
  settingsCodeLength: document.querySelector("#settings-code-length"),
  settingsPaletteSize: document.querySelector("#settings-palette-size"),
  settingsAllowDuplicates: document.querySelector("#settings-allow-duplicates"),
  settingsMaxRows: document.querySelector("#settings-max-rows"),
  settingsSoundToggle: document.querySelector("#settings-sound-toggle"),
  settingsSoundLabel: document.querySelector("#settings-sound-label"),
  settingsHaptics: document.querySelector("#settings-haptics"),
  settingsTimerEnabled: document.querySelector("#settings-timer-enabled"),
  settingsTimerSeconds: document.querySelector("#settings-timer-seconds"),
  settingsHighContrast: document.querySelector("#settings-high-contrast"),
  settingsLargeText: document.querySelector("#settings-large-text"),
  settingsReducedMotion: document.querySelector("#settings-reduced-motion"),
  saveSettings: document.querySelector("#save-settings"),
  settingsNewGame: document.querySelector("#settings-new-game"),
  statsGames: document.querySelector("#stats-games"),
  statsWins: document.querySelector("#stats-wins"),
  statsLosses: document.querySelector("#stats-losses"),
  statsWinRate: document.querySelector("#stats-win-rate"),
  statsCurrentStreak: document.querySelector("#stats-current-streak"),
  statsBestStreak: document.querySelector("#stats-best-streak"),
  statsBestTurns: document.querySelector("#stats-best-turns"),
  statsAverageTurns: document.querySelector("#stats-average-turns"),
  codeLength: document.querySelector("#code-length"),
  paletteSize: document.querySelector("#palette-size"),
  allowDuplicates: document.querySelector("#allow-duplicates"),
  soundToggle: document.querySelector("#sound-toggle"),
  soundLabel: document.querySelector("#sound-label"),
  hapticsToggle: document.querySelector("#haptics-toggle"),
  hapticsLabel: document.querySelector("#haptics-label"),
  modal: document.querySelector("#modal"),
  modalClose: document.querySelector("#modal-close"),
};

const paletteMap = new Map(PALETTE.map((color) => [color.id, color]));
const modalOpenButtons = document.querySelectorAll(".js-how-to");

const STORAGE_KEY = "mastermind-state";
const SETTINGS_KEY = "mastermind-settings";
const STATS_KEY = "mastermind-stats";

let settings = loadSettings();
let state = createInitialState(settings);
let boardRows = [];
let eraseMode = false;
let soundEnabled = settings.soundEnabled;
let audioContext = null;
let hintTimeout = null;
let timerInterval = null;
let currentScreen = "home";
let soundEnabled = false;
let hapticsEnabled = false;
let audioContext = null;
let hintTimeout = null;
const hintLastShownAt = new Map();
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
  if (!elements.settingsSoundLabel) {
    return;
  }
  elements.settingsSoundLabel.textContent = soundEnabled ? "Sound (on)" : "Sound (off)";
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(Math.max(number, min), max);
}

function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (!saved) {
    return { ...DEFAULT_OPTIONS };
  }
  try {
    const parsed = JSON.parse(saved);
    return { ...DEFAULT_OPTIONS, ...parsed };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

function saveSettings(nextSettings) {
  settings = { ...settings, ...nextSettings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  soundEnabled = settings.soundEnabled;
  updateSoundLabel();
  applyAccessibility(settings);
  updateTimerDisplay();
}

function applySettingsToForm(currentSettings) {
  elements.settingsCodeLength.value = String(currentSettings.codeLength);
  elements.settingsPaletteSize.value = String(currentSettings.paletteSize);
  elements.settingsAllowDuplicates.checked = currentSettings.allowDuplicates;
  elements.settingsMaxRows.value = String(currentSettings.maxRows);
  elements.settingsSoundToggle.checked = currentSettings.soundEnabled;
  elements.settingsHaptics.checked = currentSettings.hapticsEnabled;
  elements.settingsTimerEnabled.checked = currentSettings.timerEnabled;
  elements.settingsTimerSeconds.value = String(currentSettings.timerSeconds);
  elements.settingsHighContrast.checked = currentSettings.highContrast;
  elements.settingsLargeText.checked = currentSettings.largeText;
  elements.settingsReducedMotion.checked = currentSettings.reducedMotion;
}

function getSettingsFromForm() {
  return {
    codeLength: clampNumber(elements.settingsCodeLength.value, 3, 6, DEFAULT_OPTIONS.codeLength),
    paletteSize: clampNumber(elements.settingsPaletteSize.value, 4, 8, DEFAULT_OPTIONS.paletteSize),
    allowDuplicates: elements.settingsAllowDuplicates.checked,
    maxRows: clampNumber(elements.settingsMaxRows.value, 6, 14, DEFAULT_OPTIONS.maxRows),
    soundEnabled: elements.settingsSoundToggle.checked,
    hapticsEnabled: elements.settingsHaptics.checked,
    timerEnabled: elements.settingsTimerEnabled.checked,
    timerSeconds: clampNumber(elements.settingsTimerSeconds.value, 60, 1800, DEFAULT_OPTIONS.timerSeconds),
    highContrast: elements.settingsHighContrast.checked,
    largeText: elements.settingsLargeText.checked,
    reducedMotion: elements.settingsReducedMotion.checked,
  };
}

function applyAccessibility(currentSettings) {
  document.body.classList.toggle("theme-high-contrast", currentSettings.highContrast);
  document.body.classList.toggle("theme-large-text", currentSettings.largeText);
  document.body.classList.toggle("theme-reduced-motion", currentSettings.reducedMotion);
}

function loadStats() {
  const saved = localStorage.getItem(STATS_KEY);
  if (!saved) {
    return {
      games: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0,
      bestTurns: null,
      averageTurns: null,
    };
  }
  try {
    return JSON.parse(saved);
  } catch {
    return {
      games: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0,
      bestTurns: null,
      averageTurns: null,
    };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function recordStats(result, turns) {
  const stats = loadStats();
  stats.games += 1;
  if (result === "won") {
    stats.wins += 1;
    stats.currentStreak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    if (stats.bestTurns === null || turns < stats.bestTurns) {
      stats.bestTurns = turns;
    }
  } else {
    stats.losses += 1;
    stats.currentStreak = 0;
  }
  const previousAverage = Number(stats.averageTurns);
  if (Number.isFinite(previousAverage)) {
    stats.averageTurns = (previousAverage * (stats.games - 1) + turns) / stats.games;
  } else {
    stats.averageTurns = turns;
  }
  saveStats(stats);
  renderStats(stats);
}

function renderStats(stats = loadStats()) {
  const winRate = stats.games ? Math.round((stats.wins / stats.games) * 100) : 0;
  elements.statsGames.textContent = String(stats.games);
  elements.statsWins.textContent = String(stats.wins);
  elements.statsLosses.textContent = String(stats.losses);
  elements.statsWinRate.textContent = `${winRate}%`;
  elements.statsCurrentStreak.textContent = String(stats.currentStreak);
  elements.statsBestStreak.textContent = String(stats.bestStreak);
  elements.statsBestTurns.textContent =
    stats.bestTurns === null ? "-" : `${stats.bestTurns} turn${stats.bestTurns === 1 ? "" : "s"}`;
  elements.statsAverageTurns.textContent =
    stats.averageTurns === null ? "-" : stats.averageTurns.toFixed(1);
}

function triggerHaptics(pattern) {
  if (!settings.hapticsEnabled) {
    return;
  }
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

function formatTimer(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function updateTimerDisplay() {
  if (!elements.timerValue) {
    return;
  }
  if (!state.options.timerEnabled) {
    elements.timerValue.textContent = "Off";
    return;
  }
  const remaining = Number.isFinite(state.timerRemaining)
    ? Math.max(state.timerRemaining, 0)
    : settings.timerSeconds;
  elements.timerValue.textContent = formatTimer(remaining);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  stopTimer();
  if (!state.options.timerEnabled || state.status !== "playing") {
    updateTimerDisplay();
    return;
  }
  if (!Number.isFinite(state.timerRemaining)) {
    state.timerRemaining = state.options.timerSeconds;
  }
  updateTimerDisplay();
  timerInterval = window.setInterval(() => {
    if (state.status !== "playing") {
      stopTimer();
      return;
    }
    state.timerRemaining = Math.max(0, state.timerRemaining - 1);
    updateTimerDisplay();
    if (state.timerRemaining <= 0) {
      handleTimedOut();
    }
    saveState();
  }, 1000);
}

function updateStatusPanel() {
  if (elements.rowCounter) {
    elements.rowCounter.textContent = `${state.currentRow + 1} / ${state.options.maxRows}`;
  }
  updateTimerDisplay();
}

function updateResumeAvailability() {
  const savedState = loadState();
  const hasResume = Boolean(savedState);
  elements.resumeGame.disabled = false;
  elements.resumeGame.textContent = hasResume ? "Resume Game" : "Play";
  elements.resumeStatus.textContent = hasResume
    ? "Continue your in-progress game."
    : "Start a new puzzle or continue your last game.";
}

function setScreen(screen) {
  const screens = {
    home: elements.screenHome,
    game: elements.screenGame,
    settings: elements.screenSettings,
    stats: elements.screenStats,
  };
  Object.entries(screens).forEach(([key, node]) => {
    if (!node) {
      return;
    }
    node.hidden = key !== screen;
  });
  elements.headerActions.hidden = screen === "home";
  if (screen === "stats") {
    renderStats();
  }
  if (screen === "game") {
    startTimer();
  } else {
    stopTimer();
  }
  if (screen === "home") {
    updateResumeAvailability();
  }
  currentScreen = screen;
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

function showHint(type, message) {
  if (state.status !== "playing") {
    return;
  }
  const now = Date.now();
  const lastShownAt = hintLastShownAt.get(type);
  if (lastShownAt && now - lastShownAt < 5000) {
    return;
  }
  hintLastShownAt.set(type, now);
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
  updateStatusPanel();
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
    return hydrateState(parsed, settings);
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
  state.options = { ...settings };

  resetGuesses(state);
  hintLastShownAt.clear();
  setEraseMode(false);
  updateNextFillIndex();
  state.timerRemaining = state.options.timerEnabled ? state.options.timerSeconds : null;

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
  startTimer();
}

function updateSlot(rowIndex, colIndex, value) {
  const previousValue = state.guesses[rowIndex][colIndex];
  state.guesses[rowIndex][colIndex] = value;
  elements.statusMessage.textContent = "";
  updateNextFillIndex();
  updateBoard();
  if (value && value !== previousValue) {
    playSound("place");
    triggerHaptics(20);
  }
  if (!value && previousValue) {
    playSound("erase");
    triggerHaptics([10, 40, 10]);
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

  if (state.editIndex === colIndex) {
    state.editIndex = null;
    updateBoard();
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

function endGame({ status, message, sound }) {
  if (state.status !== "playing") {
    return;
  }
  state.status = status;
  elements.statusMessage.textContent = message;
  renderReveal(elements.reveal, state.secret, paletteMap);
  elements.submit.disabled = true;
  playSound(sound);
  stopTimer();
  recordStats(status, state.currentRow + 1);
  saveState();
  updateResumeAvailability();
}

function handleTimedOut() {
  if (state.status !== "playing") {
    return;
  }
  endGame({ status: "lost", message: "Time's up. The code was:", sound: "lose" });
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
  triggerHaptics(30);
  const feedback = scoreGuess(state.secret, currentGuess);
  state.feedback[state.currentRow] = feedback;
  updateBoard();

  if (feedback.blacks === state.options.codeLength) {
    endGame({ status: "won", message: "You cracked the code!", sound: "win" });
    return;
  }

  if (state.currentRow === state.options.maxRows - 1) {
    endGame({ status: "lost", message: "No more turns. The code was:", sound: "lose" });
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
        showHint("duplicate", "That color is already used.");
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
    showHint("rowFull", "Tap a slot to replace.");
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

  if (currentScreen !== "game") {
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

function handleDocumentClick(event) {
  if (state.editIndex === null || state.status !== "playing") {
    return;
  }
  const activeRow = boardRows[state.currentRow]?.row;
  if (activeRow && activeRow.contains(event.target)) {
    return;
  }
  const protectedElements = [
    elements.palette,
    elements.submit,
    elements.erase,
    elements.newGame,
    elements.codeLength,
    elements.paletteSize,
    elements.allowDuplicates,
    elements.soundToggle,
    elements.modal,
    elements.modalOpen,
    elements.modalClose,
  ];
  if (protectedElements.some((element) => element?.contains(event.target))) {
    return;
  }
  state.editIndex = null;
  updateBoard();
}

function wireEvents() {
  elements.board.addEventListener("click", handleSlotClick);
  elements.board.addEventListener("contextmenu", handleSlotRightClick);
  elements.palette.addEventListener("click", handlePaletteClick);
  elements.submit.addEventListener("click", submitGuess);
  elements.erase.addEventListener("click", toggleErase);
  elements.newGame.addEventListener("click", () => {
    startNewGame();
    setScreen("game");
  });
  elements.navHome.addEventListener("click", () => setScreen("home"));
  elements.resumeGame.addEventListener("click", () => {
    const loadedState = loadState();
    if (loadedState) {
      applyLoadedState(loadedState);
    } else {
      startNewGame();
    }
    setScreen("game");
  });
  elements.homeNewGame.addEventListener("click", () => {
    startNewGame();
    setScreen("game");
  });
  elements.openSettings.addEventListener("click", () => setScreen("settings"));
  elements.openStats.addEventListener("click", () => setScreen("stats"));
  modalOpenButtons.forEach((button) => {
    button.addEventListener("click", () => openModal(elements.modal));
  });
  elements.modalClose.addEventListener("click", () => closeModal(elements.modal));
  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) {
      closeModal(elements.modal);
    }
  });
  document.addEventListener("keydown", handleKeydown);
  const settingsInputs = [
    elements.settingsCodeLength,
    elements.settingsPaletteSize,
    elements.settingsAllowDuplicates,
    elements.settingsMaxRows,
    elements.settingsSoundToggle,
    elements.settingsHaptics,
    elements.settingsTimerEnabled,
    elements.settingsTimerSeconds,
    elements.settingsHighContrast,
    elements.settingsLargeText,
    elements.settingsReducedMotion,
  ];
  settingsInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const updatedSettings = getSettingsFromForm();
      saveSettings(updatedSettings);
      if (soundEnabled) {
        ensureAudioContext();
      }
    });
  });
  elements.saveSettings.addEventListener("click", () => {
    const updatedSettings = getSettingsFromForm();
    saveSettings(updatedSettings);
  });
  elements.settingsNewGame.addEventListener("click", () => {
    const updatedSettings = getSettingsFromForm();
    saveSettings(updatedSettings);
    startNewGame();
    setScreen("game");
  document.addEventListener("click", handleDocumentClick);
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
  boardRows = createBoard(elements.board, state.options.maxRows, state.options.codeLength);
  elements.statusMessage.textContent = "";
  elements.reveal.innerHTML = "";
  updateNextFillIndex();
  updateBoard();
  startTimer();
}

function initializeGame() {
  applySettingsToForm(settings);
  applyAccessibility(settings);
  updateSoundLabel();
  renderStats();
  updateResumeAvailability();
  state = createInitialState(settings);
  setScreen("home");
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
