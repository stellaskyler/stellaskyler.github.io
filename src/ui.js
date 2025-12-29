export function createBoard(container, rows, codeLength) {
  container.style.setProperty("--code-length", codeLength);
  container.innerHTML = "";
  const rowEls = [];

  for (let i = 0; i < rows; i += 1) {
    const row = document.createElement("div");
    row.className = "board__row";

    const pegRow = document.createElement("div");
    pegRow.className = "row__pegs";

    for (let j = 0; j < codeLength; j += 1) {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "peg-slot";
      slot.dataset.row = String(i);
      slot.dataset.col = String(j);
      slot.setAttribute("aria-label", `Row ${i + 1} slot ${j + 1}`);
      pegRow.appendChild(slot);
    }

    const keyPegs = document.createElement("div");
    keyPegs.className = "key-pegs";

    row.appendChild(pegRow);
    row.appendChild(keyPegs);
    container.appendChild(row);
    rowEls.push({ row, pegRow, keyPegs });
  }

  return rowEls;
}

export function renderPalette(container, palette, paletteSize, disabledColors = new Set()) {
  container.innerHTML = "";
  palette.slice(0, paletteSize).forEach((color, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette__option";
    button.dataset.index = String(index);
    button.setAttribute("aria-label", color.name);
    const isDisabled = disabledColors.has(color.id);
    button.setAttribute("aria-disabled", isDisabled ? "true" : "false");

    const swatch = document.createElement("div");
    swatch.className = "palette__swatch";
    swatch.style.background = color.hex;
    swatch.textContent = color.symbol;
    swatch.title = color.name;

    button.appendChild(swatch);

    button.classList.toggle("is-disabled", isDisabled);

    container.appendChild(button);
  });
}

export function renderRowGuess(rowElements, guess, paletteMap, isActiveRow, editIndex) {
  const slots = rowElements.pegRow.querySelectorAll(".peg-slot");
  slots.forEach((slot, index) => {
    const value = guess[index];
    slot.textContent = value ? paletteMap.get(value).symbol : "";
    slot.style.background = value ? paletteMap.get(value).hex : "#f8fafc";
    slot.classList.toggle("filled", Boolean(value));
    slot.classList.toggle("active", isActiveRow);
    slot.classList.toggle("targeted", isActiveRow && editIndex === index);
    slot.setAttribute("aria-pressed", isActiveRow && editIndex === index ? "true" : "false");
    slot.disabled = !isActiveRow;
  });
}

export function renderFeedback(rowElements, feedback) {
  rowElements.keyPegs.innerHTML = "";
  if (!feedback) {
    return;
  }

  const items = [
    ...Array.from({ length: feedback.blacks }, () => "black"),
    ...Array.from({ length: feedback.whites }, () => "white"),
  ];

  items.forEach((kind) => {
    const peg = document.createElement("div");
    peg.className = `key-peg ${kind}`;
    rowElements.keyPegs.appendChild(peg);
  });
}

export function renderReveal(container, secret, paletteMap) {
  container.innerHTML = "";
  secret.forEach((color) => {
    const peg = document.createElement("div");
    peg.className = "peg-slot filled";
    peg.style.width = "40px";
    peg.style.height = "40px";
    peg.style.borderRadius = "12px";
    peg.style.background = paletteMap.get(color).hex;
    peg.textContent = paletteMap.get(color).symbol;
    container.appendChild(peg);
  });
}

export function openModal(modal) {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

export function closeModal(modal) {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}
