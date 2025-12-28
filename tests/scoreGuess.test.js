import assert from "node:assert/strict";
import { scoreGuess } from "../src/gameLogic.js";

const tests = [
  {
    name: "Example A",
    secret: ["R", "R", "G", "B"],
    guess: ["R", "G", "R", "Y"],
    expected: { blacks: 1, whites: 2 },
  },
  {
    name: "Example B",
    secret: ["Y", "Y", "Y", "Y"],
    guess: ["Y", "B", "Y", "B"],
    expected: { blacks: 2, whites: 0 },
  },
  {
    name: "Example C",
    secret: ["R", "G", "B", "Y"],
    guess: ["Y", "B", "G", "R"],
    expected: { blacks: 0, whites: 4 },
  },
  {
    name: "No matches",
    secret: ["R", "R", "R", "R"],
    guess: ["G", "G", "G", "G"],
    expected: { blacks: 0, whites: 0 },
  },
  {
    name: "Duplicates mixed",
    secret: ["R", "G", "R", "B"],
    guess: ["R", "R", "G", "G"],
    expected: { blacks: 1, whites: 2 },
  },
];

for (const test of tests) {
  const result = scoreGuess(test.secret, test.guess);
  assert.deepEqual(result, test.expected, test.name);
}

console.log("All scoreGuess tests passed.");
