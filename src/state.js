export function createInitialState(options) {
  return {
    options: { ...options },
    secret: [],
    guesses: Array.from({ length: options.maxRows }, () => Array(options.codeLength).fill(null)),
    feedback: Array.from({ length: options.maxRows }, () => null),
    currentRow: 0,
    nextFillIndex: 0,
    editIndex: null,
    status: "playing",
  };
}

export function resetGuesses(state) {
  state.guesses = Array.from({ length: state.options.maxRows }, () =>
    Array(state.options.codeLength).fill(null),
  );
  state.feedback = Array.from({ length: state.options.maxRows }, () => null);
  state.currentRow = 0;
  state.nextFillIndex = 0;
  state.editIndex = null;
  state.status = "playing";
}

function normalizeRows(rows, maxRows, codeLength) {
  const normalized = Array.from({ length: maxRows }, (_, rowIndex) => {
    const row = Array.isArray(rows?.[rowIndex]) ? rows[rowIndex] : [];
    const trimmed = row.slice(0, codeLength);
    if (trimmed.length < codeLength) {
      trimmed.push(...Array(codeLength - trimmed.length).fill(null));
    }
    return trimmed;
  });
  return normalized;
}

export function serializeState(state) {
  return {
    options: { ...state.options },
    secret: [...state.secret],
    guesses: state.guesses.map((row) => [...row]),
    feedback: state.feedback.map((entry) => (entry ? { ...entry } : null)),
    currentRow: state.currentRow,
    editIndex: state.editIndex,
    status: state.status,
  };
}

export function hydrateState(savedState, fallbackOptions) {
  if (!savedState || savedState.status !== "playing") {
    return null;
  }
  const options = { ...fallbackOptions, ...savedState.options };
  const state = createInitialState(options);
  if (Array.isArray(savedState.secret)) {
    state.secret = [...savedState.secret];
  }
  state.guesses = normalizeRows(savedState.guesses, options.maxRows, options.codeLength);
  state.feedback = Array.from({ length: options.maxRows }, (_, rowIndex) => {
    const entry = savedState.feedback?.[rowIndex];
    return entry && typeof entry === "object"
      ? { blacks: entry.blacks ?? 0, whites: entry.whites ?? 0 }
      : null;
  });
  state.currentRow = Number.isInteger(savedState.currentRow)
    ? Math.min(Math.max(savedState.currentRow, 0), options.maxRows - 1)
    : 0;
  state.editIndex =
    Number.isInteger(savedState.editIndex) &&
    savedState.editIndex >= 0 &&
    savedState.editIndex < options.codeLength
      ? savedState.editIndex
      : null;
  state.status = "playing";
  return state;
}
