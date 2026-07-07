import { createDynkinDatum } from "./dynkin.mjs?v=20260708-open-richardson-cgg";
import { buildDoubleInductiveWeave } from "./weave.mjs?v=20260708-open-richardson-cgg";
import { renderTrace } from "./render.mjs?v=20260708-open-richardson-cgg";

const form = document.querySelector("#input-form");
const rankInput = document.querySelector("#rank-input");
const wInput = document.querySelector("#w-input");
const vInput = document.querySelector("#v-input");
const vcInput = document.querySelector("#vc-input");
const doubleStringInput = document.querySelector("#double-string-input");
const output = document.querySelector("#output");
const errorBox = document.querySelector("#error-box");
const exampleButton = document.querySelector("#example-button");
const randomButton = document.querySelector("#random-button");
const generateButton = document.querySelector("#generate-button");

const defaultExample = {
  rank: "3",
  w: "1 2 1 3 2 1",
  v: "2 3",
  vc: "",
  doubleString: "",
};

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = text;
  return node;
}

function parsePositiveInteger(text, name) {
  const value = Number.parseInt(String(text ?? "").trim(), 10);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}

function parseTypeAWord(text, name, rank) {
  const raw = String(text ?? "").trim();
  if (raw === "") return [];
  const compact = /^[1-9][0-9]*$/.test(raw) && !/[\s,()[\]{}]/.test(raw);
  const sequence = compact && rank <= 9
    ? raw.split("").map((entry) => Number.parseInt(entry, 10))
    : raw.split(/[\s,()[\]{}]+/).filter(Boolean).map((entry) => Number.parseInt(entry, 10));
  if (sequence.some((entry) => !Number.isInteger(entry))) throw new Error(`${name} must be a word in simple reflection indices.`);
  const bad = sequence.find((entry) => entry < 1 || entry > rank);
  if (bad !== undefined) throw new Error(`${name} contains ${bad}, outside type A_${rank}.`);
  return sequence;
}

function normalizeDoubleStringText(text) {
  return String(text ?? "")
    .replace(/\\mathbf\{L\}|\\bfL|\\mathcal\{L\}|\\calL/g, "L")
    .replace(/\\mathbf\{R\}|\\bfR|\\mathcal\{R\}|\\calR/g, "R")
    .replace(/\^\{?\+}?/g, "+")
    .replace(/[()[\]{},]/g, " ")
    .trim();
}

function parseDoubleString(text) {
  const normalized = normalizeDoubleStringText(text);
  if (normalized === "") throw new Error("Double string is empty.");
  const tokens = normalized.split(/\s+/);
  const entries = [];
  for (let idx = 0; idx < tokens.length; idx += 1) {
    const token = tokens[idx];
    const compact = /^([1-9][0-9]*)([LRlr])(\+)?$/.exec(token);
    if (compact) {
      entries.push({
        h: Number.parseInt(compact[1], 10),
        side: compact[2].toUpperCase(),
        plus: compact[3] === "+",
      });
      continue;
    }
    const split = /^([1-9][0-9]*)$/.exec(token);
    const side = /^([LRlr])(\+)?$/.exec(tokens[idx + 1] ?? "");
    if (split && side) {
      entries.push({
        h: Number.parseInt(split[1], 10),
        side: side[1].toUpperCase(),
        plus: side[2] === "+",
      });
      idx += 1;
      continue;
    }
    throw new Error(`Invalid double string entry "${token}". Use entries like 1L, 2R, or 1L+.`);
  }
  return entries.map((entry, idx) => ({ ...entry, step: idx + 1, source: entry.source ?? "custom" }));
}

function identityAction(size) {
  return Array.from({ length: size }, (_, idx) => idx + 1);
}

function simpleReflectionAction(index, size) {
  const out = identityAction(size);
  [out[index - 1], out[index]] = [out[index], out[index - 1]];
  return out;
}

function multiplyActions(left, right) {
  return right.map((value) => left[value - 1]);
}

function actionOfWord(word, rank) {
  const size = rank + 1;
  let out = identityAction(size);
  word.forEach((generator) => {
    out = multiplyActions(out, simpleReflectionAction(generator, size));
  });
  return out;
}

function sameAction(left, right) {
  return left.length === right.length && left.every((value, idx) => value === right[idx]);
}

function inverseAction(action) {
  const out = Array(action.length);
  action.forEach((value, idx) => {
    out[value - 1] = idx + 1;
  });
  return out;
}

function longestAction(rank) {
  return Array.from({ length: rank + 1 }, (_, idx) => rank + 1 - idx);
}

function coxeterLengthOfAction(action) {
  let out = 0;
  for (let i = 0; i < action.length; i += 1) {
    for (let j = i + 1; j < action.length; j += 1) {
      if (action[i] > action[j]) out += 1;
    }
  }
  return out;
}

function reducedWordForAction(action) {
  const arr = action.slice();
  const rank = arr.length - 1;
  const word = [];
  while (true) {
    let changed = false;
    for (let idx = 0; idx < rank; idx += 1) {
      if (arr[idx] > arr[idx + 1]) {
        [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
        word.push(idx + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return word.reverse();
}

function reduceCoxeterWord(word, rank) {
  return reducedWordForAction(actionOfWord(word, rank));
}

function sameCoxeterElement(leftWord, rightWord, rank) {
  return sameAction(actionOfWord(leftWord, rank), actionOfWord(rightWord, rank));
}

function longestWord(rank) {
  return reducedWordForAction(longestAction(rank));
}

function isReducedTypeAWord(word, rank) {
  return coxeterLengthOfAction(actionOfWord(word, rank)) === word.length;
}

function starGeneratorTypeA(generator, rank) {
  return rank + 1 - generator;
}

function starWordForRichardsonRepresentative(word, rank) {
  return word.slice().reverse().map((generator) => starGeneratorTypeA(generator, rank));
}

function complementWordForVStar(vStarWord, rank) {
  const complementAction = multiplyActions(longestAction(rank), inverseAction(actionOfWord(vStarWord, rank)));
  return reducedWordForAction(complementAction);
}

function combinationsOfSize(length, size) {
  const out = [];
  function visit(start, chosen) {
    if (chosen.length === size) {
      out.push(chosen.slice());
      return;
    }
    for (let idx = start; idx <= length - (size - chosen.length) + 1; idx += 1) {
      chosen.push(idx);
      visit(idx + 1, chosen);
      chosen.pop();
    }
  }
  visit(1, []);
  return out;
}

function rightmostRepresentativePositions({ vWord, wWord, rank }) {
  const size = vWord.length;
  for (const positions of combinationsOfSize(wWord.length, size).reverse()) {
    const subword = positions.map((position) => wWord[position - 1]);
    if (sameCoxeterElement(subword, vWord, rank)) {
      return { positions, subword };
    }
  }
  throw new Error("No rightmost representative of v was found inside β(w). Check that v <= w and that β(w) is reduced.");
}

function formatEntry(entry) {
  return `${entry.h}${entry.side}${entry.plus ? "+" : ""}`;
}

function formatDoubleString(entries) {
  return entries.map(formatEntry).join(" ");
}

function makeLeftRichardsonDoubleString({ vcWord, wWord, plusPositions }) {
  const plusSet = new Set(plusPositions);
  let freeIndex = 0;
  return [
    ...vcWord.slice().reverse().map((entry, idx) => ({
      source: "vc",
      block: "v^c",
      t: vcWord.length - idx,
      h: entry,
      side: "L",
      plus: true,
    })),
    ...wWord.slice().reverse().map((entry, idx) => {
      const wPosition = wWord.length - idx;
      const plus = plusSet.has(wPosition);
      if (!plus) freeIndex += 1;
      return {
        source: plus ? "w-plus" : "w-free",
        block: "w",
        t: wPosition,
        wPosition,
        freeIndex: plus ? null : freeIndex,
        h: entry,
        side: "L",
        plus,
      };
    }),
  ].map((entry, idx) => ({ ...entry, step: idx + 1 }));
}

function readRichardsonDataInput() {
  const rank = parsePositiveInteger(rankInput.value, "rank");
  const wWord = parseTypeAWord(wInput.value, "β(w)", rank);
  const vWord = parseTypeAWord(vInput.value, "v", rank);
  if (wWord.length === 0) throw new Error("β(w) must be nonempty.");
  if (!isReducedTypeAWord(wWord, rank)) throw new Error("β(w) must be reduced.");
  if (!isReducedTypeAWord(vWord, rank)) throw new Error("v must be entered as a reduced word.");
  const { positions: plusPositions, subword: rightmostWord } = rightmostRepresentativePositions({ vWord, wWord, rank });
  const vStarWord = starWordForRichardsonRepresentative(rightmostWord, rank);
  const computedVcWord = complementWordForVStar(vStarWord, rank);
  const vcWord = String(vcInput.value ?? "").trim() === ""
    ? computedVcWord
    : parseTypeAWord(vcInput.value, "β(v^c)", rank);
  if (!isReducedTypeAWord(vcWord, rank)) throw new Error("β(v^c) must be reduced.");
  if (!sameCoxeterElement(vcWord.concat(vStarWord), longestWord(rank), rank)) {
    throw new Error("The entered β(v^c) does not satisfy β(v^c)β(v^*) = β(w_0).");
  }
  const generatedDoubleString = makeLeftRichardsonDoubleString({ vcWord, wWord, plusPositions });
  return {
    rank,
    dynkin: createDynkinDatum({ family: "A", rank }),
    wWord,
    vWord,
    vcWord,
    computedVcWord,
    vStarWord,
    plusPositions,
    rightmostWord,
    generatedDoubleString,
  };
}

function generatedDoubleStringText() {
  const data = readRichardsonDataInput();
  vcInput.placeholder = data.computedVcWord.join(" ");
  return formatDoubleString(data.generatedDoubleString);
}

function buildOpenRichardsonTrace() {
  const data = readRichardsonDataInput();
  const activeText = doubleStringInput.value.trim() === "" ? formatDoubleString(data.generatedDoubleString) : doubleStringInput.value;
  if (doubleStringInput.value.trim() === "") doubleStringInput.value = activeText;
  const parsedDoubleString = parseDoubleString(activeText);
  parsedDoubleString.forEach((entry) => {
    if (entry.h < 1 || entry.h > data.rank) throw new Error(`Double string contains ${entry.h}, outside type A_${data.rank}.`);
  });
  const firstPass = buildDoubleInductiveWeave(parsedDoubleString, data.dynkin);
  const doubleString = parsedDoubleString.map((entry, idx) => ({
    ...entry,
    plus: firstPass.stepInfos[idx]?.plus ?? entry.plus,
  }));
  const bottomWeave = buildDoubleInductiveWeave(doubleString, data.dynkin, { coordinatePrefix: "z" });
  doubleStringInput.value = formatDoubleString(doubleString);
  const topBoundaryWord = bottomWeave.words[0]?.slice() ?? [];
  const topCoordinates = topBoundaryWord.map((_, idx) => `z${idx + 1}`);
  const generatedText = formatDoubleString(data.generatedDoubleString);
  const activeGenerated = formatDoubleString(doubleString) === generatedText;
  const plusSet = new Set(data.plusPositions);
  const terminalVStarBlock = data.vStarWord.slice();
  const editorParams = new URLSearchParams({
    family: "A",
    rank: String(data.rank),
    s: formatDoubleString(doubleString),
  });

  return {
    mode: "double-string",
    family: "A",
    dynkin: data.dynkin,
    rank: data.rank,
    doubleString,
    topWeave: {
      words: [topBoundaryWord],
      moves: [],
      sourceWord: topBoundaryWord.slice(),
      sourceCoordinates: topCoordinates,
      coordinateRows: [topCoordinates],
      coordinateSubstitution: {},
    },
    bottomWeave,
    fullClusterValues: bottomWeave.coordinateAvailable ? bottomWeave.clusterValues ?? [] : [],
    fullClusterValuesOmitted: !bottomWeave.coordinateAvailable,
    fullClusterValuesOmittedReason: bottomWeave.coordinateAvailable ? "" : "Coordinate formulas are not implemented for this type.",
    weaveTitle: activeGenerated ? "𝒲_Ric^L" : "𝒲(s)",
    weaveSubtitle: activeGenerated
      ? "𝒲_Ric^L is the double inductive weave attached to the CGGLS-Ménard left Richardson double string."
      : "The active double string has been edited; the weave is computed from the textarea.",
    junctionLabel: activeGenerated ? "s_Ric^L" : "s",
    quiverLabel: activeGenerated ? "Q(𝒲_Ric^L)" : "Q(𝒲(s))",
    matrixLabel: activeGenerated ? "B(Q(𝒲_Ric^L))" : "B(Q(𝒲(s)))",
    variableHeader: activeGenerated ? "A_t = A_t(𝒲_Ric^L)" : "A_t = A_t(𝒲(s))",
    openRichardson: {
      rank: data.rank,
      vWord: data.vWord,
      wWord: data.wWord,
      vcWord: data.vcWord,
      computedVcWord: data.computedVcWord,
      rightmostWord: data.rightmostWord,
      plusPositions: data.plusPositions,
      nonPlusPositions: data.wWord.map((_, idx) => idx + 1).filter((position) => !plusSet.has(position)),
      generatedDoubleString: data.generatedDoubleString,
      generatedText,
      activeGenerated,
      dimension: data.wWord.length - data.vWord.length,
      terminalVStarBlock,
      editorHref: `./double-string-weave.html?${editorParams.toString()}`,
    },
  };
}

function textWord(word) {
  return word.length === 0 ? "e" : word.join(" ");
}

function chipRow(entries) {
  const chips = el("div", "double-string-chips");
  entries.forEach((entry) => {
    const chip = el("span", `double-string-chip ${entry.plus ? "prefix" : "chain"}`, formatEntry(entry));
    chip.title = entry.source === "vc"
      ? `β(v^c), original position ${entry.t}`
      : entry.source === "w-plus"
        ? `β(w), original position ${entry.wPosition} in P_Ric`
        : entry.source === "w-free"
          ? `β(w), original position ${entry.wPosition} not in P_Ric`
          : `active double string step ${entry.step}`;
    chips.appendChild(chip);
  });
  return chips;
}

function renderRichardsonData(trace) {
  const ric = trace.openRichardson;
  const card = el("section", "card richardson-data-card");
  card.appendChild(el("h2", "", "CGGLS Richardson Data"));
  const grid = el("div", "ric-data-grid");
  [
    ["type", `A_${trace.rank}`],
    ["β(w)", textWord(ric.wWord)],
    ["v", textWord(ric.vWord)],
    ["β(v^c)", textWord(ric.vcWord)],
    ["β(v*)", textWord(ric.terminalVStarBlock)],
    ["rightmost representative", textWord(ric.rightmostWord)],
    ["P_Ric", `{${ric.plusPositions.join(", ")}}`],
    ["M_Ric", `{${ric.nonPlusPositions.join(", ")}}`],
    ["dim R(v,w)", String(ric.dimension)],
    ["β(v^c)β(v*)", textWord(ric.vcWord.concat(ric.terminalVStarBlock))],
  ].forEach(([label, value]) => {
    const row = el("div", "ric-data-row");
    row.append(el("span", "ric-data-key", label), el("span", "formula ric-data-value", value));
    grid.appendChild(row);
  });
  card.appendChild(grid);

  const generated = el("div", "double-string-expression richardson-string-expression");
  generated.appendChild(el("span", "formula", "CGGLS s_Ric^L = "));
  generated.appendChild(chipRow(ric.generatedDoubleString));
  card.appendChild(generated);

  if (!ric.activeGenerated) {
    card.appendChild(el("p", "small-note", "The active double string was edited. The Richardson data above still records the CGGLS string generated from (v,w), while the weave below is computed from the textarea."));
  }

  const actions = el("div", "chain-box-move-actions richardson-actions");
  const editorLink = el("a", "secondary-button", "Open active string in double-string editor");
  editorLink.href = ric.editorHref;
  actions.appendChild(editorLink);
  card.appendChild(actions);

  const note = el("p", "small-note");
  note.textContent = "CGGLS Theorem 10.1 uses the left inductive weave for X(β(w)β(v^c)). Since left inductive strings are reversed, the displayed CGGLS double string is β(v^c) and β(w) in reverse order, with + marks at P_Ric.";
  card.appendChild(note);
  return card;
}

function renderOpenRichardsonTrace(trace) {
  const root = el("div", "trace-view open-richardson-cgg-trace");
  root.appendChild(renderRichardsonData(trace));
  const weaveMount = el("div", "open-richardson-weave-mount");
  root.appendChild(weaveMount);
  output.replaceChildren(root);
  renderTrace(trace, weaveMount);
}

function readInput() {
  return {
    rank: rankInput.value,
    w: wInput.value,
    v: vInput.value,
    vc: vcInput.value,
    doubleString: doubleStringInput.value,
  };
}

function writeInput(values) {
  rankInput.value = values.rank;
  wInput.value = values.w;
  vInput.value = values.v;
  vcInput.value = values.vc ?? "";
  doubleStringInput.value = values.doubleString ?? "";
}

function setError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = "";
  errorBox.hidden = true;
}

function syncUrl(trace) {
  if (!window.history?.replaceState) return;
  const ric = trace.openRichardson;
  const url = new URL(window.location.href);
  url.searchParams.set("rank", String(trace.rank));
  url.searchParams.set("w", ric.wWord.join(" "));
  url.searchParams.set("v", ric.vWord.join(" "));
  if (vcInput.value.trim() === "") url.searchParams.delete("vc");
  else url.searchParams.set("vc", ric.vcWord.join(" "));
  url.searchParams.set("s", formatDoubleString(trace.doubleString));
  window.history.replaceState(null, "", url);
}

function runConstruction({ preserveUrl = false } = {}) {
  try {
    clearError();
    const trace = buildOpenRichardsonTrace(readInput());
    vcInput.placeholder = trace.openRichardson.computedVcWord.join(" ");
    renderOpenRichardsonTrace(trace);
    if (!preserveUrl) syncUrl(trace);
  } catch (error) {
    output.replaceChildren();
    setError(error instanceof Error ? error.message : String(error));
  }
}

function inputFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const rank = params.get("rank");
    const w = params.get("w");
    const v = params.get("v");
    const vc = params.get("vc");
    const doubleString = params.get("s");
    if (!rank && !w && !v && !vc && !doubleString) return null;
    return {
      rank: rank ?? defaultExample.rank,
      w: w ?? defaultExample.w,
      v: v ?? defaultExample.v,
      vc: vc ?? "",
      doubleString: doubleString ?? "",
    };
  } catch {
    return null;
  }
}

function randomInteger(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomReducedWord(rank, targetLength) {
  let word = [];
  let current = identityAction(rank + 1);
  while (word.length < targetLength) {
    const candidates = [];
    for (let generator = 1; generator <= rank; generator += 1) {
      const next = multiplyActions(current, simpleReflectionAction(generator, rank + 1));
      if (coxeterLengthOfAction(next) === coxeterLengthOfAction(current) + 1) candidates.push({ generator, next });
    }
    if (candidates.length === 0) break;
    const chosen = candidates[randomInteger(0, candidates.length - 1)];
    word = [...word, chosen.generator];
    current = chosen.next;
  }
  return word;
}

function randomSubsetPositions(length, size) {
  const positions = Array.from({ length }, (_, idx) => idx + 1);
  for (let idx = positions.length - 1; idx > 0; idx -= 1) {
    const swapIdx = randomInteger(0, idx);
    [positions[idx], positions[swapIdx]] = [positions[swapIdx], positions[idx]];
  }
  return positions.slice(0, size).sort((left, right) => left - right);
}

function randomExample() {
  const rank = parsePositiveInteger(rankInput.value || defaultExample.rank, "rank");
  const maxLength = (rank * (rank + 1)) / 2;
  const wLength = randomInteger(Math.min(2, maxLength), maxLength);
  const wWord = randomReducedWord(rank, wLength);
  const vLength = randomInteger(0, Math.max(0, wWord.length - 1));
  const positions = randomSubsetPositions(wWord.length, vLength);
  const vWord = positions.map((position) => wWord[position - 1]);
  return {
    rank: String(rank),
    w: wWord.join(" "),
    v: vWord.join(" "),
    vc: "",
    doubleString: "",
  };
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runConstruction();
});

exampleButton.addEventListener("click", () => {
  writeInput(defaultExample);
  doubleStringInput.value = generatedDoubleStringText();
  runConstruction();
});

randomButton.addEventListener("click", () => {
  try {
    clearError();
    writeInput(randomExample());
    doubleStringInput.value = generatedDoubleStringText();
    runConstruction();
  } catch (error) {
    output.replaceChildren();
    setError(error instanceof Error ? error.message : String(error));
  }
});

generateButton.addEventListener("click", () => {
  try {
    clearError();
    doubleStringInput.value = generatedDoubleStringText();
    runConstruction();
  } catch (error) {
    output.replaceChildren();
    setError(error instanceof Error ? error.message : String(error));
  }
});

const urlInput = inputFromUrl();
writeInput(urlInput ?? defaultExample);
if (!urlInput?.doubleString) {
  try {
    doubleStringInput.value = generatedDoubleStringText();
  } catch {
    doubleStringInput.value = "";
  }
}
runConstruction({ preserveUrl: Boolean(urlInput) });
