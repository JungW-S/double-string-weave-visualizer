import { createDynkinDatum } from "./dynkin.mjs?v=20260710-layered-compare-fit";
import { completeWeaveFromComputedStrips } from "./weave.mjs?v=20260710-layered-compare-fit";
import {
  cycleColor,
  renderClusterVariableAnswerPanel,
  renderInteractiveWeaveViewer,
  renderQuiverAnswerPanel,
} from "./render.mjs?v=20260710-layered-compare-fit";

const form = document.querySelector("#input-form");
const rankInput = document.querySelector("#rank-input");
const wInput = document.querySelector("#w-input");
const vInput = document.querySelector("#v-input");
const vcInput = document.querySelector("#vc-input");
const layerInput = document.querySelector("#layer-input");
const layerOutput = document.querySelector("#layer-output");
const output = document.querySelector("#output");
const errorBox = document.querySelector("#error-box");
const photoExampleButton = document.querySelector("#photo-example-button");
const smallExampleButton = document.querySelector("#small-example-button");
const randomExampleButton = document.querySelector("#random-example-button");
const compareToggleButton = document.querySelector("#compare-toggle-button");
const layerPrevButton = document.querySelector("#layer-prev-button");
const layerNextButton = document.querySelector("#layer-next-button");

const examples = {
  photo: {
    rank: "4",
    w: "1 2 3 4 2 3 1 2",
    v: "2 3",
    vc: "",
  },
  small: {
    rank: "2",
    w: "1 2 1",
    v: "2",
    vc: "",
  },
};

let currentData = null;
let currentLayer = 0;
let currentActiveLayer = 0;
let compareOpen = false;
let compareLayerA = null;
let compareLayerB = null;

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = text;
  return node;
}

function htmlEl(tag, className = "", html = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== "") node.innerHTML = html;
  return node;
}

function subscriptNumber(value) {
  const subscripts = new Map([
    ["0", "₀"],
    ["1", "₁"],
    ["2", "₂"],
    ["3", "₃"],
    ["4", "₄"],
    ["5", "₅"],
    ["6", "₆"],
    ["7", "₇"],
    ["8", "₈"],
    ["9", "₉"],
  ]);
  return String(value).replace(/[0-9]/g, (digit) => subscripts.get(digit) ?? digit);
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

function leftMultiplyAction(generator, action, rank) {
  return multiplyActions(simpleReflectionAction(generator, rank + 1), action);
}

function rightMultiplyAction(action, generator, rank) {
  return multiplyActions(action, simpleReflectionAction(generator, rank + 1));
}

function sameAction(left, right) {
  return left.length === right.length && left.every((value, idx) => value === right[idx]);
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

function isReducedTypeAWord(word, rank) {
  return coxeterLengthOfAction(actionOfWord(word, rank)) === word.length;
}

function randomInteger(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function lengthIncreasingRightGenerators(action, rank) {
  const currentLength = coxeterLengthOfAction(action);
  const options = [];
  for (let generator = 1; generator <= rank; generator += 1) {
    const candidate = rightMultiplyAction(action, generator, rank);
    if (coxeterLengthOfAction(candidate) > currentLength) options.push(generator);
  }
  return options;
}

function randomReducedWord(rank) {
  const longestLength = (rank * (rank + 1)) / 2;
  const minLength = Math.min(longestLength, Math.max(2, rank + 1));
  const maxLength = Math.min(longestLength, Math.max(minLength, 2 * rank + 3));
  const targetLength = randomInteger(minLength, maxLength);
  let action = identityAction(rank + 1);
  const word = [];

  while (word.length < targetLength) {
    const options = lengthIncreasingRightGenerators(action, rank);
    if (options.length === 0) break;
    const generator = options[randomInteger(0, options.length - 1)];
    word.push(generator);
    action = rightMultiplyAction(action, generator, rank);
  }

  return word;
}

function randomReducedSubword(word, rank) {
  let action = identityAction(rank + 1);
  const out = [];
  const selectionRate = 0.28 + Math.random() * 0.32;

  word.forEach((generator) => {
    const candidate = rightMultiplyAction(action, generator, rank);
    if (coxeterLengthOfAction(candidate) <= coxeterLengthOfAction(action)) return;
    if (Math.random() < selectionRate) {
      out.push(generator);
      action = candidate;
    }
  });

  if (out.length === 0 && word.length > 0 && Math.random() < 0.85) {
    out.push(word[randomInteger(0, word.length - 1)]);
  }

  if (out.length === word.length && out.length > 1) out.pop();
  return out;
}

function textWord(word) {
  return word.length === 0 ? "e" : word.join("");
}

function spacedWord(word) {
  return word.length === 0 ? "e" : word.join(" ");
}

function textSet(values) {
  return `{${values.join(",")}}`;
}

function wordActionLabel(action) {
  return textWord(reducedWordForAction(action));
}

function inverseAction(action) {
  const out = [];
  action.forEach((value, idx) => {
    out[value - 1] = idx + 1;
  });
  return out;
}

function vcActionFor(vWord, rank) {
  return multiplyActions(longestAction(rank), inverseAction(actionOfWord(vWord, rank)));
}

function computedVcWord(vWord, rank) {
  return reducedWordForAction(vcActionFor(vWord, rank));
}

function validateVcWord(vcWord, vWord, rank) {
  if (!isReducedTypeAWord(vcWord, rank)) throw new Error("β(v^c) must be reduced.");
  const expected = vcActionFor(vWord, rank);
  const actual = actionOfWord(vcWord, rank);
  if (!sameAction(actual, expected)) {
    throw new Error("The entered β(v^c) does not represent w_0 v^{-1}.");
  }
}

function buildGreedySequence({ rank, wWord, vWord }) {
  let current = actionOfWord(vWord, rank);
  const rows = [{
    index: 1,
    action: current.slice(),
    word: reducedWordForAction(current),
  }];
  const steps = [];
  const tVector = [];
  const freePositions = [];
  const usedPositions = [];

  wWord.forEach((generator, idx) => {
    const k = idx + 1;
    const before = current.slice();
    const candidate = leftMultiplyAction(generator, current, rank);
    const beforeLength = coxeterLengthOfAction(before);
    const candidateLength = coxeterLengthOfAction(candidate);
    const used = candidateLength < beforeLength;
    const next = used ? candidate : before;
    const t = used ? 0 : 1;
    if (t === 1) freePositions.push(k);
    else usedPositions.push(k);
    tVector.push(t);
    steps.push({
      k,
      generator,
      before,
      beforeWord: reducedWordForAction(before),
      candidate,
      candidateWord: reducedWordForAction(candidate),
      beforeLength,
      candidateLength,
      relation: candidateLength > beforeLength ? ">" : "<",
      used,
      t,
      next,
      nextWord: reducedWordForAction(next),
    });
    current = next;
    rows.push({
      index: k + 1,
      action: current.slice(),
      word: reducedWordForAction(current),
    });
  });

  if (coxeterLengthOfAction(current) !== 0) {
    throw new Error("The greedy sequence did not end at e. Check that v <= w for the entered β(w).");
  }

  return {
    rows,
    steps,
    tVector,
    freePositions,
    usedPositions,
  };
}

function buildLayeredPath({ rank, wWord, greedy }) {
  const steps = [{
    a: 0,
    originalK: null,
    generator: null,
    tau: null,
    wWord: [],
    vWord: [],
    wAction: identityAction(rank + 1),
    vAction: identityAction(rank + 1),
  }];
  let wLayerWord = [];
  let vLayerWord = [];
  let wAction = identityAction(rank + 1);
  let vAction = identityAction(rank + 1);

  for (let a = 1; a <= wWord.length; a += 1) {
    const originalK = wWord.length - a + 1;
    const generator = wWord[originalK - 1];
    const tau = greedy.tVector[originalK - 1];
    wLayerWord = [generator, ...wLayerWord];
    wAction = leftMultiplyAction(generator, wAction, rank);
    if (tau === 0) {
      vLayerWord = [generator, ...vLayerWord];
      vAction = leftMultiplyAction(generator, vAction, rank);
    }
    steps.push({
      a,
      originalK,
      generator,
      tau,
      wWord: wLayerWord.slice(),
      vWord: vLayerWord.slice(),
      wAction: wAction.slice(),
      vAction: vAction.slice(),
    });
  }

  return steps;
}

function makeAllRightDoubleString({ vcWord, wWord, startOriginalK, tVector }) {
  return [
    ...vcWord.map((generator, idx) => ({
      source: "vc",
      block: "v^c",
      vcPosition: idx + 1,
      h: generator,
      side: "R",
      plus: false,
    })),
    ...wWord.map((generator, idx) => {
      const originalK = startOriginalK + idx;
      const tau = tVector[originalK - 1];
      return {
        source: tau === 1 ? "w-free" : "w-used",
        block: "w",
        originalK,
        layer: tVector.length - originalK + 1,
        tau,
        h: generator,
        side: "R",
        plus: false,
      };
    }),
  ].map((entry, idx) => ({ ...entry, step: idx + 1 }));
}

function wordKey(word) {
  return word.join(",");
}

function coxeterBraidLengthTypeA(left, right) {
  if (left === right) return 1;
  return Math.abs(left - right) === 1 ? 3 : 2;
}

function braidNeighborsTypeA(word) {
  const out = [];
  for (let pos = 0; pos < word.length - 1; pos += 1) {
    const left = word[pos];
    const right = word[pos + 1];
    if (left !== right && coxeterBraidLengthTypeA(left, right) === 2) {
      out.push({
        word: [...word.slice(0, pos), right, left, ...word.slice(pos + 2)],
        move: { type: "tetra", pos },
      });
    }
  }
  for (let pos = 0; pos < word.length - 2; pos += 1) {
    const left = word[pos];
    const middle = word[pos + 1];
    const right = word[pos + 2];
    if (left === right && coxeterBraidLengthTypeA(left, middle) === 3) {
      out.push({
        word: [...word.slice(0, pos), middle, left, middle, ...word.slice(pos + 3)],
        move: { type: "hexa", pos },
      });
    }
  }
  return out;
}

function reconstructBraidPath(targetKey, records) {
  const words = [];
  const moves = [];
  let cursor = targetKey;
  while (cursor !== null) {
    const record = records.get(cursor);
    words.push(record.word.slice());
    if (record.move !== null) moves.push(record.move);
    cursor = record.parent;
  }
  words.reverse();
  moves.reverse();
  return { words, moves };
}

function braidPathBetweenWordsTypeA(startWord, targetWord) {
  const startKey = wordKey(startWord);
  const targetKey = wordKey(targetWord);
  if (startKey === targetKey) return { words: [startWord.slice()], moves: [] };

  const queue = [startWord.slice()];
  const records = new Map([[startKey, {
    parent: null,
    move: null,
    word: startWord.slice(),
  }]]);
  const maxVisited = Math.max(12000, 4000 * startWord.length);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    if (records.size > maxVisited) break;
    const word = queue[cursor];
    for (const neighbor of braidNeighborsTypeA(word)) {
      const neighborKey = wordKey(neighbor.word);
      if (records.has(neighborKey)) continue;
      records.set(neighborKey, {
        parent: wordKey(word),
        move: neighbor.move,
        word: neighbor.word.slice(),
      });
      if (neighborKey === targetKey) return reconstructBraidPath(targetKey, records);
      queue.push(neighbor.word);
    }
  }

  throw new Error(`Could not find a braid-only path from ${textWord(startWord)} to ${textWord(targetWord)}.`);
}

function firstAdjacentPair(word, generator) {
  for (let pos = 0; pos < word.length - 1; pos += 1) {
    if (word[pos] === generator && word[pos + 1] === generator) return pos;
  }
  return -1;
}

function findTrivalentLayerTypeA(topWord, bottomWord, generator) {
  const startKey = wordKey(topWord);
  const queue = [topWord.slice()];
  const records = new Map([[startKey, {
    parent: null,
    move: null,
    word: topWord.slice(),
  }]]);
  const maxVisited = Math.max(18000, 5000 * topWord.length);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    if (records.size > maxVisited) break;
    const word = queue[cursor];
    const pairPos = firstAdjacentPair(word, generator);
    if (pairPos >= 0) {
      const postTriWord = [
        ...word.slice(0, pairPos),
        generator,
        ...word.slice(pairPos + 2),
      ];
      try {
        const beforeTri = reconstructBraidPath(wordKey(word), records);
        const afterTri = braidPathBetweenWordsTypeA(postTriWord, bottomWord);
        return {
          words: [
            ...beforeTri.words,
            postTriWord,
            ...afterTri.words.slice(1),
          ],
          moves: [
            ...beforeTri.moves,
            { type: "tri", pos: pairPos },
            ...afterTri.moves,
          ],
          triMoveOffset: beforeTri.moves.length,
        };
      } catch {
        // This adjacent pair does not lead to the required lower boundary.
      }
    }

    for (const neighbor of braidNeighborsTypeA(word)) {
      const neighborKey = wordKey(neighbor.word);
      if (records.has(neighborKey)) continue;
      records.set(neighborKey, {
        parent: wordKey(word),
        move: neighbor.move,
        word: neighbor.word.slice(),
      });
      queue.push(neighbor.word);
    }
  }

  throw new Error(`Could not build a trivalent layer ${textWord(topWord)} -> ${textWord(bottomWord)} for generator ${generator}.`);
}

function boundaryWordsForLayers({ rank, layer, pathSteps, overrideVcWord }) {
  return pathSteps.slice(0, layer + 1).map((step) => {
    const useOverride = step.a === pathSteps.length - 1 && overrideVcWord !== null;
    const vcWord = useOverride ? overrideVcWord.slice() : computedVcWord(step.vWord, rank);
    return [...vcWord, ...step.wWord];
  });
}

function buildLayeredRightInductiveWeave({ rank, dynkin, layer, pathSteps, tVector, wWord, overrideVcWord, doubleString }) {
  const boundaries = boundaryWordsForLayers({ rank, layer, pathSteps, overrideVcWord });
  const words = [boundaries[layer].slice()];
  const moves = [];
  const stepInfos = [];
  let clusterCount = 0;

  for (let a = layer; a >= 1; a -= 1) {
    const step = pathSteps[a];
    const topWord = words[words.length - 1];
    const bottomWord = boundaries[a - 1];
    if (wordKey(topWord) !== wordKey(boundaries[a])) {
      throw new Error(`Internal layer mismatch at a=${a}: expected top boundary ${textWord(boundaries[a])}, got ${textWord(topWord)}.`);
    }

    const layerPath = step.tau === 1
      ? findTrivalentLayerTypeA(topWord, bottomWord, step.generator)
      : braidPathBetweenWordsTypeA(topWord, bottomWord);

    if (layerPath.moves.length === 0) {
      moves.push({
        type: "straight",
        pos: 0,
        sourceStep: a,
        entryLabel: `${step.generator}R`,
        originalK: step.originalK,
        tau: step.tau,
        block: "w",
      });
      words.push(words[words.length - 1].slice());
      continue;
    }

    let triMoveIndex = null;
    layerPath.moves.forEach((move, idx) => {
      const globalMoveIndex = moves.length;
      if (move.type === "tri") triMoveIndex = globalMoveIndex;
      moves.push({
        ...move,
        sourceStep: a,
        entryLabel: `${step.generator}R`,
        originalK: step.originalK,
        tau: step.tau,
        block: "w",
      });
      words.push(layerPath.words[idx + 1].slice());
    });

    if (step.tau === 1) {
      clusterCount += 1;
      stepInfos.push({
        step: a,
        absoluteStep: null,
        entryLabel: `${step.generator}R`,
        generator: step.generator,
        side: "R",
        plus: false,
        clusterVariable: `A${clusterCount}`,
        triMoveIndex,
        bottomReducedWordAfterStep: bottomWord.slice(),
        originalK: step.originalK,
        tau: step.tau,
        block: "w",
        source: "w-free",
      });
    }
  }

  return {
    ...completeWeaveFromComputedStrips({
      dynkin,
      doubleString,
      words,
      moves,
      stepInfos,
    }, { coordinatePrefix: "z" }),
    layerBoundaryWords: boundaries,
  };
}

function buildPartialData(data, layer) {
  const pathStep = data.pathSteps[layer];
  const startOriginalK = data.wWord.length - layer + 1;
  const finalLayer = layer === data.wWord.length;
  const computedVc = computedVcWord(pathStep.vWord, data.rank);
  const vcWord = finalLayer && data.overrideVcWord !== null ? data.overrideVcWord.slice() : computedVc;
  const jWord = [...vcWord, ...pathStep.wWord];
  const doubleString = makeAllRightDoubleString({
    vcWord,
    wWord: pathStep.wWord,
    startOriginalK,
    tVector: data.greedy.tVector,
  });
  const dynkin = createDynkinDatum({ family: "A", rank: data.rank });
  const bottomWeave = buildLayeredRightInductiveWeave({
    rank: data.rank,
    dynkin,
    layer,
    pathSteps: data.pathSteps,
    tVector: data.greedy.tVector,
    wWord: data.wWord,
    overrideVcWord: data.overrideVcWord,
    doubleString,
  });
  const normalizedDoubleString = doubleString.map((entry, idx) => ({
    ...entry,
    step: idx + 1,
    plus: entry.block === "v^c" || entry.tau === 0,
  }));
  const layerStrips = computeLayerStrips({
    bottomWeave,
    doubleString: normalizedDoubleString,
    layer,
    activeLayer: data.activeLayer ?? layer,
    tVector: data.greedy.tVector,
    wWord: data.wWord,
  });
  const topBoundaryWord = Array.isArray(bottomWeave.words?.[0])
    ? bottomWeave.words[0].slice()
    : jWord.slice();
  const topCoordinates = topBoundaryWord.map((_, idx) => `z${idx + 1}`);
  const trace = {
    mode: "layered-richardson",
    family: "A",
    dynkin,
    rank: data.rank,
    doubleString: normalizedDoubleString,
    topWeave: {
      words: [topBoundaryWord],
      moves: [],
      sourceWord: topBoundaryWord.slice(),
      sourceCoordinates: topCoordinates,
      coordinateRows: [topCoordinates],
      coordinateSubstitution: {},
    },
    bottomWeave,
    layerStrips,
    fullClusterValues: bottomWeave.clusterValues ?? [],
    fullClusterValuesOmitted: false,
    junctionLabel: "s_{w,v}",
    weaveTitle: `𝒲_layer(a=${layer})`,
    weaveSubtitle: `All-right double string for v^c w^{(${layer})}.`,
    quiverLabel: `Q(𝒲_layer(a=${layer}))`,
    matrixLabel: `B(Q(𝒲_layer(a=${layer})))`,
    variableHeader: `A_t = A_t(𝒲_layer(a=${layer}))`,
  };

  return {
    layer,
    pathStep,
    startOriginalK,
    computedVc,
    vcWord,
    jWord: topBoundaryWord,
    doubleString: normalizedDoubleString,
    trace,
  };
}

function computeLayerStrips({ bottomWeave, layer, activeLayer, tVector, wWord }) {
  const moves = bottomWeave.moves ?? [];
  const stepInfoByTriMove = new Map(
    (bottomWeave.stepInfos ?? [])
      .filter((info) => Number.isInteger(info.triMoveIndex))
      .map((info) => [info.triMoveIndex, info]),
  );
  const moveIndicesBySourceStep = new Map();
  moves.forEach((move, moveIdx) => {
    if (!Number.isInteger(move.sourceStep)) return;
    if (!moveIndicesBySourceStep.has(move.sourceStep)) moveIndicesBySourceStep.set(move.sourceStep, []);
    moveIndicesBySourceStep.get(move.sourceStep).push(moveIdx);
  });

  const strips = [];
  for (let a = layer; a >= 1; a -= 1) {
    const originalK = wWord.length - a + 1;
    const moveIndices = moveIndicesBySourceStep.get(a) ?? [];
    const startMove = moveIndices.length > 0 ? Math.min(...moveIndices) : moves.length;
    const endMove = moveIndices.length > 0 ? Math.max(...moveIndices) + 1 : startMove;
    const tau = tVector[originalK - 1];
    const clusterLabels = [];
    for (let moveIdx = startMove; moveIdx < endMove; moveIdx += 1) {
      const info = stepInfoByTriMove.get(moveIdx);
      if (info?.clusterVariable) clusterLabels.push(info.clusterVariable);
    }
    strips.push({
      layer: a,
      startMove,
      endMove,
      caseType: tau === 1 ? "case2" : "case1",
      generator: wWord[originalK - 1],
      active: a === activeLayer,
      clusterLabels,
      label: `a=${a}, k=${originalK}, i=${wWord[originalK - 1]}, τ=${tau}`,
      empty: endMove <= startMove,
    });
  }
  return strips;
}

function chipForEntry(entry) {
  const chip = el("span", [
    "double-string-chip",
    entry.block === "v^c" ? "prefix" : "chain",
    entry.source === "w-free" ? "side-r reverse-free" : "",
    entry.source === "w-used" ? "side-l reverse-used" : "",
  ].filter(Boolean).join(" "));
  chip.textContent = `${entry.h}R${entry.plus ? "+" : ""}`;
  if (entry.block === "v^c") {
    chip.title = `v^c letter ${entry.vcPosition}; ${entry.plus ? "length-increasing (+)" : "trivalent step"}`;
  } else {
    chip.title = `w-position k=${entry.originalK}, layer a=${entry.layer}, τ_a=t_k=${entry.tau}; ${entry.plus ? "length-increasing (+)" : "trivalent step"}`;
  }
  return chip;
}

function renderDoubleStringChips(entries) {
  const chips = el("div", "double-string-chips reverse-double-string-chips");
  entries.forEach((entry) => chips.appendChild(chipForEntry(entry)));
  return chips;
}

function renderConventionCard(data, partial) {
  const card = el("section", "card reverse-convention-card");
  card.appendChild(el("h2", "", "Convention"));
  const formula = el("div", "gls-formula-box reverse-formula-box");
  formula.appendChild(htmlEl("p", "", "<span class=\"formula\">v<sup>c</sup>=w<sub>0</sub>v<sup>-1</sup></span>."));
  formula.appendChild(htmlEl("p", "", "<span class=\"formula\">v<sup>c</sup>β(w)=(j<sub>1</sub>,...,j<sub>ℓ</sub>)</span>."));
  formula.appendChild(htmlEl("p", "", "<span class=\"formula\">s<sub>w,v</sub>=(j<sub>1</sub>R,...,j<sub>ℓ</sub>R)</span>."));
  formula.appendChild(htmlEl("p", "", "Draw the right inductive weave attached to the all-right string <span class=\"formula\">s<sub>w,v</sub></span>."));
  formula.appendChild(htmlEl("p", "", "The greedy sequence uses <span class=\"formula\">s<sub>iₖ</sub>v<sub>≥k</sub></span>, following the board definition."));
  card.appendChild(formula);

  const grid = el("div", "ric-data-grid layered-data-grid reverse-facts-grid");
  [
    ["type", `A${subscriptNumber(data.rank)}`],
    ["β(w)", textWord(data.wWord)],
    ["v", textWord(data.vWord)],
    ["current layer", `a=${partial.layer}`],
    ["wᵃ", textWord(partial.pathStep.wWord)],
    ["vᵃ", textWord(partial.pathStep.vWord)],
    ["β((vᵃ)ᶜ)", textWord(partial.vcWord)],
    ["top boundary jᵃ", textWord(partial.jWord)],
    ["[1,r]_v", textSet(data.greedy.freePositions)],
    ["t_k by word", `(${data.greedy.tVector.join(",")})`],
    ["τ_a by layer", `(${data.greedy.tVector.slice().reverse().join(",")})`],
  ].forEach(([key, value]) => {
    const row = el("div", "ric-data-row");
    row.append(el("span", "ric-data-key", key), el("span", "formula ric-data-value", value));
    grid.appendChild(row);
  });
  card.appendChild(grid);
  if (data.overrideVcWord !== null && partial.layer !== data.wWord.length) {
    card.appendChild(el("p", "small-note", "The optional β(v^c) is used only at the final layer. Intermediate layers use the computed representative of w_0(v^(a))^{-1}."));
  }
  return card;
}

function renderGreedyTable(data) {
  const card = el("section", "card reverse-table-card");
  card.appendChild(el("h2", "", "Greedy sequence v≥k"));
  const table = el("table", "gls-data-table reverse-data-table");
  const head = el("thead");
  const headRow = el("tr");
  ["k", "iₖ", "v≥k", "sᵢₖ v≥k", "comparison", "v≥k+1", "tₖ"].forEach((label) => headRow.appendChild(el("th", "", label)));
  head.appendChild(headRow);
  table.appendChild(head);
  const body = el("tbody");
  data.greedy.steps.forEach((step) => {
    const tr = el("tr");
    tr.appendChild(el("td", "formula", String(step.k)));
    tr.appendChild(el("td", "formula", String(step.generator)));
    tr.appendChild(el("td", "formula", textWord(step.beforeWord)));
    tr.appendChild(el("td", "formula", textWord(step.candidateWord)));
    tr.appendChild(el("td", step.used ? "reverse-used-cell" : "reverse-free-cell", `s${subscriptNumber(step.generator)} v ${step.relation} v`));
    tr.appendChild(el("td", "formula", textWord(step.nextWord)));
    tr.appendChild(el("td", step.t === 1 ? "reverse-free-cell" : "reverse-used-cell", String(step.t)));
    body.appendChild(tr);
  });
  table.appendChild(body);
  card.appendChild(table);
  const note = el("p", "small-note");
  note.textContent = "Here t_k is indexed by the original word position k. Layer a uses τ_a=t_{r-a+1}.";
  card.appendChild(note);
  return card;
}

function renderPathTable(data, layer) {
  const card = el("section", "card reverse-path-card");
  card.appendChild(el("h2", "", "Layered path"));
  const table = el("table", "gls-data-table reverse-data-table");
  const head = el("thead");
  const headRow = el("tr");
  ["a", "k", "hₐ", "τₐ=tₖ", "wᵃ", "vᵃ"].forEach((label) => headRow.appendChild(el("th", "", label)));
  head.appendChild(headRow);
  table.appendChild(head);
  const body = el("tbody");
  data.pathSteps.forEach((step) => {
    const tr = el("tr");
    if (step.a === layer) tr.classList.add("reverse-active-row");
    tr.appendChild(el("td", "formula", String(step.a)));
    tr.appendChild(el("td", "formula", step.originalK === null ? "-" : String(step.originalK)));
    tr.appendChild(el("td", "formula", step.generator === null ? "-" : String(step.generator)));
    tr.appendChild(el("td", step.tau === 1 ? "reverse-free-cell" : step.tau === 0 ? "reverse-used-cell" : "", step.tau === null ? "-" : String(step.tau)));
    tr.appendChild(el("td", "formula", textWord(step.wWord)));
    tr.appendChild(el("td", "formula", textWord(step.vWord)));
    body.appendChild(tr);
  });
  table.appendChild(body);
  card.appendChild(table);
  return card;
}

function renderWeakBruhatPath(data, layer) {
  const card = el("section", "card layered-visual-card layered-weak-card");
  const head = el("div", "layered-panel-head");
  head.appendChild(el("h3", "", "Layer stacking path"));
  const legend = el("div", "layered-path-legend");
  [
    ["case1", "τₐ=0"],
    ["case2", "τₐ=1"],
  ].forEach(([className, label]) => {
    const item = el("span", "layered-path-legend-item");
    item.appendChild(el("span", `layered-path-swatch ${className}`));
    item.appendChild(el("span", "", label));
    legend.appendChild(item);
  });
  head.appendChild(legend);
  card.appendChild(head);

  const steps = data.pathSteps;
  const edgeCount = Math.max(steps.length - 1, 1);
  const gap = 138;
  const width = Math.max(720, 120 + gap * edgeCount);
  const height = 188;
  const y = 82;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "layered-weak-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Weak Bruhat path determined by the t sequence");

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  [
    ["case1", "#2563eb"],
    ["case2", "#dc2626"],
    ["muted", "#9aaab2"],
  ].forEach(([name, color]) => {
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", `layered-weak-arrow-${name}`);
    marker.setAttribute("markerWidth", "9");
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "3.5");
    marker.setAttribute("orient", "auto");
    const headPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    headPath.setAttribute("d", "M0,0 L9,3.5 L0,7 Z");
    headPath.setAttribute("fill", color);
    marker.appendChild(headPath);
    defs.appendChild(marker);
  });
  svg.appendChild(defs);

  function svgNode(name) {
    return document.createElementNS("http://www.w3.org/2000/svg", name);
  }

  function appendSvgText(parent, x, yy, text, className) {
    const node = svgNode("text");
    node.setAttribute("x", String(x));
    node.setAttribute("y", String(yy));
    node.setAttribute("class", className);
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  steps.slice(1).forEach((step) => {
    const prevX = 58 + gap * (step.a - 1);
    const nextX = 58 + gap * step.a;
    const className = step.tau === 1 ? "case2" : "case1";
    const active = step.a === layer;
    const edge = svgNode("line");
    edge.setAttribute("x1", String(prevX + 23));
    edge.setAttribute("x2", String(nextX - 23));
    edge.setAttribute("y1", String(y));
    edge.setAttribute("y2", String(y));
    edge.setAttribute("class", [
      "layered-weak-edge",
      "path-edge",
      className,
      step.a <= layer ? "built" : "future",
      active ? "active" : "",
    ].filter(Boolean).join(" "));
    edge.setAttribute("marker-end", `url(#layered-weak-arrow-${step.a <= layer ? className : "muted"})`);
    edge.addEventListener("click", () => setLayer(step.a));
    svg.appendChild(edge);

    const midX = (prevX + nextX) / 2;
    appendSvgText(svg, midX, y - 22, `k=${step.originalK}, i=${step.generator}`, `layered-edge-label ${className}`);
    appendSvgText(svg, midX, y + 34, `τ=${step.tau}`, `layered-edge-label ${className} ${active ? "active" : ""}`);
  });

  steps.forEach((step) => {
    const x = 58 + gap * step.a;
    const group = svgNode("g");
    group.setAttribute("class", [
      "layered-weak-node-group",
      step.a <= layer ? "on-path" : "",
      step.a === layer ? "active" : "",
    ].filter(Boolean).join(" "));
    group.addEventListener("click", () => setLayer(step.a));
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", `Set layer ${step.a}`);
    const circle = svgNode("circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", "22");
    circle.setAttribute("class", "layered-weak-node");
    group.appendChild(circle);
    appendSvgText(group, x, y + 4, `a=${step.a}`, "layered-weak-label");
    appendSvgText(group, x, y + 48, `w=${textWord(step.wWord)}`, "layered-weak-state-label");
    appendSvgText(group, x, y + 64, `v=${textWord(step.vWord)}`, "layered-weak-state-label muted");
    svg.appendChild(group);
  });

  const scroll = el("div", "layered-weak-scroll");
  scroll.appendChild(svg);
  card.appendChild(scroll);
  const note = el("p", "small-note");
  note.textContent = "Click a node or colored edge to move the layer. Blue means τ_a=0; red means τ_a=1.";
  card.appendChild(note);
  return card;
}

function renderLayerCards(data, layer, activeLayer) {
  const card = el("section", "card reverse-layer-card");
  card.appendChild(el("h2", "", "Built layers"));
  const strip = el("div", "layered-stack reverse-layer-stack");
  data.pathSteps.slice(1, layer + 1).reverse().forEach((step) => {
    const button = el("button", [
      "layer-card",
      step.tau === 1 ? "case2" : "case1",
      step.a === activeLayer ? "active" : "",
    ].filter(Boolean).join(" "));
    button.type = "button";
    button.addEventListener("click", () => setActiveLayer(step.a));
    button.appendChild(el("span", "layer-card-kicker", `a=${step.a}, k=${step.originalK}, i=${step.generator}`));
    button.appendChild(el("strong", "", step.tau === 1 ? "τ_a=1" : "τ_a=0"));
    button.appendChild(el("span", "", step.tau === 1 ? "v is unchanged in the greedy sequence" : "v is changed by left multiplication"));
    button.appendChild(el("span", "layer-card-pair", `(${textWord(data.pathSteps[step.a - 1].wWord)},${textWord(data.pathSteps[step.a - 1].vWord)}) → (${textWord(step.wWord)},${textWord(step.vWord)})`));
    strip.appendChild(button);
  });
  const base = el("button", activeLayer === 0 ? "layer-card base active" : "layer-card base");
  base.type = "button";
  base.addEventListener("click", () => setActiveLayer(0));
  base.appendChild(el("span", "layer-card-kicker", "base"));
  base.appendChild(el("strong", "", "(e,e)"));
  base.appendChild(el("span", "", "empty layer"));
  strip.appendChild(base);
  card.appendChild(strip);
  return card;
}

function renderCurrentDoubleString(partial) {
  const card = el("section", "card reverse-string-card");
  card.appendChild(el("h2", "", "All-right string at layer a"));
  const expression = el("div", "double-string-expression richardson-string-expression reverse-string-expression");
  expression.appendChild(el("span", "formula", "sᵃ(w,v) = "));
  expression.appendChild(renderDoubleStringChips(partial.doubleString));
  card.appendChild(expression);
  const note = el("p", "small-note");
  note.textContent = "The + marks length-increasing steps. Colors record the v^c block and the τ_a=t_k data in the w block.";
  card.appendChild(note);
  const legend = el("div", "reverse-chip-legend");
  [
    ["prefix", "vᶜ block"],
    ["reverse-used", "w block, τₐ=0"],
    ["reverse-free", "w block, τₐ=1"],
  ].forEach(([className, label]) => {
    const item = el("span", "reverse-chip-legend-item");
    item.appendChild(el("span", `reverse-chip-swatch ${className}`));
    item.appendChild(el("span", "", label));
    legend.appendChild(item);
  });
  card.appendChild(legend);
  return card;
}

function renderSeedPanels(trace) {
  const cycleColors = new Map((trace.bottomWeave.lusztigCycles ?? []).map((cycle, idx) => [cycle.label, cycleColor(idx)]));
  const panels = el("div", "layered-seed-panels reverse-seed-panels");
  let selectedCluster = null;

  function syncSelection() {
    panels.querySelectorAll("[data-cluster]").forEach((node) => {
      node.classList.toggle("active", selectedCluster !== null && node.dataset.cluster === selectedCluster);
    });
  }

  function selectCluster(label) {
    selectedCluster = selectedCluster === label ? null : label;
    syncSelection();
  }

  function clearSelection() {
    selectedCluster = null;
    syncSelection();
  }

  const weavePanel = el("div", "answer-panel layered-edge-variable-panel reverse-weave-panel");
  const header = el("div", "answer-panel-header");
  header.appendChild(el("h3", "", "Weave"));
  header.appendChild(el("div", "answer-panel-actions", "click edges or vertices"));
  weavePanel.appendChild(header);
  const note = el("p", "small-note");
  note.textContent = "Bands mark Richardson layers in the right inductive weave. A τ_a=1 layer contains the right-inductive braid path ending at a trivalent vertex; a τ_a=0 layer is length-increasing.";
  weavePanel.appendChild(note);
  const viewer = renderInteractiveWeaveViewer(trace, { cycleColors });
  viewer.classList.add(
    "main-interactive-weave",
    "layered-edge-variable-viewer",
  );
  weavePanel.appendChild(viewer);

  const quiverPanel = renderQuiverAnswerPanel(trace.bottomWeave, cycleColors, selectCluster, null, {
    quiverLabel: trace.quiverLabel,
    matrixLabel: trace.matrixLabel,
  });
  const clusterPanel = renderClusterVariableAnswerPanel(trace, cycleColors, selectCluster, clearSelection, {
    weaveLabel: trace.weaveTitle,
    variableHeader: trace.variableHeader,
  });

  panels.append(quiverPanel, weavePanel, clusterPanel);
  syncSelection();
  return panels;
}

function cycleColorsForWeave(weave) {
  return new Map((weave.lusztigCycles ?? []).map((cycle, idx) => [cycle.label, cycleColor(idx)]));
}

function clampCompareLayer(data, value) {
  const numeric = Number.parseInt(String(value), 10);
  const fallback = data.wWord.length;
  const layer = Number.isFinite(numeric) ? numeric : fallback;
  return Math.max(0, Math.min(data.wWord.length, layer));
}

function ensureCompareLayers(data) {
  if (compareLayerB === null) compareLayerB = currentLayer;
  if (compareLayerA === null) compareLayerA = Math.max(0, compareLayerB - 1);
  compareLayerA = clampCompareLayer(data, compareLayerA);
  compareLayerB = clampCompareLayer(data, compareLayerB);
}

function renderCompareQuiver(title, partial) {
  const block = el("section", "layer-compare-quiver-block");
  block.appendChild(el("h3", "", title));
  block.appendChild(renderQuiverAnswerPanel(partial.trace.bottomWeave, cycleColorsForWeave(partial.trace.bottomWeave), null, null, {
    quiverLabel: partial.trace.quiverLabel,
    matrixLabel: partial.trace.matrixLabel,
  }));
  return block;
}

function renderCompareWeave(title, partial) {
  const block = el("section", "layer-compare-weave-block");
  block.appendChild(el("h3", "", title));
  const viewer = renderInteractiveWeaveViewer(partial.trace, {
    cycleColors: cycleColorsForWeave(partial.trace.bottomWeave),
  });
  viewer.classList.add("layer-compare-weave-viewer");
  block.appendChild(viewer);
  return block;
}

function renderLayerComparePanel(data) {
  ensureCompareLayers(data);
  const leftLayer = compareLayerA;
  const rightLayer = compareLayerB;
  const left = buildPartialData(data, leftLayer);
  const right = buildPartialData(data, rightLayer);

  const card = el("section", "card layer-compare-card");
  const header = el("div", "layer-compare-header");
  const titleBlock = el("div");
  titleBlock.appendChild(el("h2", "", "Step comparison"));
  titleBlock.appendChild(el("p", "card-subtitle", `Compare a=${leftLayer} and a=${rightLayer}.`));
  const controls = el("div", "layer-compare-controls");
  [
    ["A", leftLayer, (value) => { compareLayerA = value; }],
    ["B", rightLayer, (value) => {
      compareLayerB = value;
      setLayer(value);
    }],
  ].forEach(([label, value, setter]) => {
    const field = el("label", "layer-compare-field");
    field.appendChild(el("span", "", label));
    const input = el("input");
    input.type = "number";
    input.min = "0";
    input.max = String(data.wWord.length);
    input.step = "1";
    input.value = String(value);
    input.addEventListener("change", () => {
      const next = clampCompareLayer(data, input.value);
      setter(next);
      if (label !== "B") renderData(data, currentLayer, currentActiveLayer);
    });
    field.appendChild(input);
    controls.appendChild(field);
  });
  const previousCurrent = el("button", "secondary-button layer-compare-preset", "previous/current");
  previousCurrent.type = "button";
  previousCurrent.addEventListener("click", () => {
    compareLayerB = currentLayer;
    compareLayerA = Math.max(0, currentLayer - 1);
    renderData(data, currentLayer, currentActiveLayer);
  });
  const currentFinal = el("button", "secondary-button layer-compare-preset", "current/final");
  currentFinal.type = "button";
  currentFinal.addEventListener("click", () => {
    compareLayerA = currentLayer;
    compareLayerB = data.wWord.length;
    renderData(data, currentLayer, currentActiveLayer);
  });
  controls.append(previousCurrent, currentFinal);
  header.append(titleBlock, controls);
  card.appendChild(header);

  const quiverGrid = el("div", "layer-compare-quiver-grid");
  quiverGrid.append(
    renderCompareQuiver(`Quiver at a=${leftLayer}`, left),
    renderCompareQuiver(`Quiver at a=${rightLayer}`, right),
  );
  card.appendChild(quiverGrid);

  const weaveGrid = el("div", "layer-compare-weave-grid");
  weaveGrid.append(
    renderCompareWeave(`Weave at a=${leftLayer}`, left),
    renderCompareWeave(`Weave at a=${rightLayer}`, right),
  );
  card.appendChild(weaveGrid);
  return card;
}

function childrenWithoutHeading(card) {
  const heading = card.querySelector("h2");
  if (heading) heading.remove();
  return Array.from(card.childNodes);
}

function renderDetailPanel(title, card, open = false) {
  const details = el("details", "layered-detail-panel");
  if (open) details.open = true;
  details.appendChild(el("summary", "layered-detail-summary", title));
  const body = el("div", "layered-detail-body");
  childrenWithoutHeading(card).forEach((child) => body.appendChild(child));
  details.appendChild(body);
  return details;
}

function renderDiagnosticsPanel(data, layer, activeLayer) {
  const card = el("section", "card layered-diagnostics-card reverse-diagnostics-card");
  card.appendChild(el("h2", "", "Details"));
  card.append(
    renderDetailPanel("Greedy sequence v≥k", renderGreedyTable(data)),
    renderDetailPanel("Layered path", renderPathTable(data, layer), true),
    renderDetailPanel("Built layers", renderLayerCards(data, layer, activeLayer)),
  );
  return card;
}

function renderData(data, layer, activeLayer = layer) {
  data.activeLayer = activeLayer;
  const partial = buildPartialData(data, layer);
  const root = el("div", "layered-richardson-view reverse-richardson-view");
  root.append(
    renderConventionCard(data, partial),
    renderWeakBruhatPath(data, layer),
    renderCurrentDoubleString(partial),
  );
  if (compareOpen) root.appendChild(renderLayerComparePanel(data));

  const weaveCard = el("section", "card layered-main-weave-card reverse-main-weave-card");
  weaveCard.appendChild(htmlEl("h2", "", `𝒲<sub>layer</sub>(a=${layer})`));
  const subtitle = el("p", "card-subtitle");
  subtitle.textContent = `Current stacked top boundary: j^${layer} = ${textWord(partial.jWord)}.`;
  weaveCard.appendChild(subtitle);
  weaveCard.appendChild(renderSeedPanels(partial.trace));
  root.appendChild(weaveCard);
  root.appendChild(renderDiagnosticsPanel(data, layer, activeLayer));
  output.replaceChildren(root);
  syncCompareToggle();
}

function readDataInput() {
  const rank = parsePositiveInteger(rankInput.value, "rank");
  const wWord = parseTypeAWord(wInput.value, "β(w)", rank);
  const vWord = parseTypeAWord(vInput.value, "v", rank);
  const overrideVcRaw = String(vcInput.value ?? "").trim();
  const overrideVcWord = overrideVcRaw === "" ? null : parseTypeAWord(overrideVcRaw, "β(v^c)", rank);
  if (wWord.length === 0) throw new Error("β(w) must be nonempty.");
  if (!isReducedTypeAWord(wWord, rank)) throw new Error("β(w) must be reduced.");
  if (!isReducedTypeAWord(vWord, rank)) throw new Error("v must be entered as a reduced word.");
  if (overrideVcWord !== null) validateVcWord(overrideVcWord, vWord, rank);
  const greedy = buildGreedySequence({ rank, wWord, vWord });
  const pathSteps = buildLayeredPath({ rank, wWord, greedy });
  if (!sameAction(pathSteps[pathSteps.length - 1].wAction, actionOfWord(wWord, rank))) {
    throw new Error("The layered path did not end at w. Check β(w).");
  }
  if (!sameAction(pathSteps[pathSteps.length - 1].vAction, actionOfWord(vWord, rank))) {
    throw new Error("The layered path did not end at v. Check the convention data.");
  }
  return {
    rank,
    wWord,
    vWord,
    overrideVcWord,
    greedy,
    pathSteps,
  };
}

function setError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = "";
  errorBox.hidden = true;
}

function syncCompareToggle() {
  if (!compareToggleButton) return;
  compareToggleButton.classList.toggle("active", compareOpen);
  compareToggleButton.setAttribute("aria-pressed", String(compareOpen));
  compareToggleButton.textContent = compareOpen ? "Hide compare" : "Compare steps";
}

function syncSlider(data, layer) {
  layerInput.min = "0";
  layerInput.max = String(data.wWord.length);
  layerInput.value = String(layer);
  layerOutput.value = `a=${layer}`;
  layerOutput.textContent = `a=${layer}`;
  if (layerPrevButton) layerPrevButton.disabled = layer <= 0;
  if (layerNextButton) layerNextButton.disabled = layer >= data.wWord.length;
  vcInput.placeholder = computedVcWord(data.vWord, data.rank).join(" ");
}

function runConstruction(requestedLayer = null) {
  try {
    clearError();
    const data = readDataInput();
    currentData = data;
    const rawLayer = requestedLayer === null ? data.wWord.length : requestedLayer;
    const layer = Math.max(0, Math.min(data.wWord.length, Number.isFinite(rawLayer) ? rawLayer : data.wWord.length));
    currentLayer = layer;
    currentActiveLayer = layer;
    if (compareOpen) {
      compareLayerB = layer;
      compareLayerA = Math.max(0, layer - 1);
    }
    syncSlider(data, layer);
    renderData(data, layer, currentActiveLayer);
  } catch (error) {
    output.replaceChildren();
    currentData = null;
    currentLayer = 0;
    currentActiveLayer = 0;
    syncCompareToggle();
    setError(error instanceof Error ? error.message : String(error));
  }
}

function setLayer(layer) {
  if (!currentData) return runConstruction(layer);
  const next = Math.max(0, Math.min(currentData.wWord.length, layer));
  currentLayer = next;
  currentActiveLayer = next;
  if (compareOpen) {
    compareLayerB = next;
    compareLayerA = Math.max(0, next - 1);
  }
  syncSlider(currentData, next);
  renderData(currentData, next, currentActiveLayer);
}

function setActiveLayer(layer) {
  if (!currentData) return;
  currentActiveLayer = Math.max(0, Math.min(currentLayer, layer));
  renderData(currentData, currentLayer, currentActiveLayer);
}

function writeExample(example) {
  rankInput.value = example.rank;
  wInput.value = example.w;
  vInput.value = example.v;
  vcInput.value = example.vc ?? "";
}

function writeRandomExample() {
  const rank = parsePositiveInteger(rankInput.value, "rank");
  const wWord = randomReducedWord(rank);
  const vWord = randomReducedSubword(wWord, rank);
  rankInput.value = String(rank);
  wInput.value = spacedWord(wWord);
  vInput.value = spacedWord(vWord);
  vcInput.value = "";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runConstruction();
});

layerInput.addEventListener("input", () => {
  if (currentData) setLayer(Number(layerInput.value));
});

layerInput.addEventListener("keydown", (event) => {
  if (!currentData) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    event.preventDefault();
    setLayer(currentLayer - 1);
  } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    event.preventDefault();
    setLayer(currentLayer + 1);
  } else if (event.key === "Home") {
    event.preventDefault();
    setLayer(0);
  } else if (event.key === "End") {
    event.preventDefault();
    setLayer(currentData.wWord.length);
  }
});

document.addEventListener("keydown", (event) => {
  if (!currentData) return;
  const target = event.target;
  const tagName = target?.tagName?.toLowerCase?.() ?? "";
  if (tagName === "textarea" || (tagName === "input" && target !== layerInput)) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    setLayer(currentLayer - 1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    setLayer(currentLayer + 1);
  }
});

if (layerPrevButton) {
  layerPrevButton.addEventListener("click", () => setLayer(currentLayer - 1));
}

if (layerNextButton) {
  layerNextButton.addEventListener("click", () => setLayer(currentLayer + 1));
}

photoExampleButton.addEventListener("click", () => {
  writeExample(examples.photo);
  runConstruction();
});

smallExampleButton.addEventListener("click", () => {
  writeExample(examples.small);
  runConstruction();
});

if (randomExampleButton) {
  randomExampleButton.addEventListener("click", () => {
    writeRandomExample();
    runConstruction();
  });
}

if (compareToggleButton) {
  compareToggleButton.addEventListener("click", () => {
    if (!currentData) runConstruction();
    if (!currentData) return;
    compareOpen = !compareOpen;
    if (compareOpen) {
      compareLayerB = currentLayer;
      compareLayerA = Math.max(0, currentLayer - 1);
    }
    renderData(currentData, currentLayer, currentActiveLayer);
  });
  syncCompareToggle();
}

writeExample(examples.photo);
runConstruction();
