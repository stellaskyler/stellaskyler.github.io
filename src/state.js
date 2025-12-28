export function createInitialState(options) {
  return {
    options: { ...options },
    secret: [],
    guesses: Array.from({ length: options.maxRows }, () => Array(options.codeLength).fill(null)),
    feedback: Array.from({ length: options.maxRows }, () => null),
    currentRow: 0,
    selectedColor: null,
    activeSlot: 0,
    status: "playing",
  };
}

export function resetGuesses(state) {
  state.guesses = Array.from({ length: state.options.maxRows }, () =>
    Array(state.options.codeLength).fill(null),
  );
  state.feedback = Array.from({ length: state.options.maxRows }, () => null);
  state.currentRow = 0;
  state.activeSlot = 0;
  state.status = "playing";
}
