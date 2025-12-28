export function generateSecret({ length, paletteSize, allowDuplicates, palette }) {
  const maxIndex = paletteSize ?? palette.length;
  if (!allowDuplicates && length > maxIndex) {
    throw new Error("Cannot generate secret without duplicates beyond palette size.");
  }

  const available = palette.slice(0, maxIndex);
  const secret = [];

  while (secret.length < length) {
    const choice = available[Math.floor(Math.random() * available.length)];
    if (!allowDuplicates && secret.includes(choice)) {
      continue;
    }
    secret.push(choice);
  }

  return secret;
}

export function validateGuess(guess, { length, paletteSize, allowDuplicates, palette }) {
  if (!Array.isArray(guess)) {
    return { valid: false, error: "Guess must be an array." };
  }
  if (guess.length !== length) {
    return { valid: false, error: `Guess must have ${length} slots.` };
  }

  const maxIndex = paletteSize ?? palette.length;
  const allowed = new Set(palette.slice(0, maxIndex));
  for (const color of guess) {
    if (!allowed.has(color)) {
      return { valid: false, error: "Guess contains an invalid color." };
    }
  }

  if (!allowDuplicates) {
    const unique = new Set(guess);
    if (unique.size !== guess.length) {
      return { valid: false, error: "Duplicates are not allowed." };
    }
  }

  return { valid: true };
}

export function scoreGuess(secret, guess) {
  let blacks = 0;
  const secretCounts = new Map();
  const guessCounts = new Map();

  for (let i = 0; i < secret.length; i += 1) {
    if (secret[i] === guess[i]) {
      blacks += 1;
    } else {
      secretCounts.set(secret[i], (secretCounts.get(secret[i]) ?? 0) + 1);
      guessCounts.set(guess[i], (guessCounts.get(guess[i]) ?? 0) + 1);
    }
  }

  let whites = 0;
  for (const [color, count] of guessCounts.entries()) {
    const matches = secretCounts.get(color) ?? 0;
    whites += Math.min(matches, count);
  }

  return { blacks, whites };
}
