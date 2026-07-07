import {
  buildDoubleInductiveWeave,
  buildTopWeave,
  computeFullClusterValues,
  expandExpressionText,
} from "./weave.mjs";
import {
  createDynkinDatum,
  normalizeDynkinFamily,
  randomHalfTwistWordForDatum,
  validateSequenceInDynkin,
} from "./dynkin.mjs";

export const defaultExample = {
  family: "A",
  rank: 3,
  r: "6",
  u: "2 3 1 2 2 1",
  rxw: "1 2 1 3 2 1",
  c: "3",
  lr: "L R L R R",
};

function randomInteger(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function parseOptionalPositiveInteger(value, name, fallback) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return fallback;
  }
  return parsePositiveInteger(value, name);
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

export function parseIntegerSequence(text, name = "sequence") {
  const normalized = String(text ?? "")
    .replace(/[()[\]{}]/g, " ")
    .replace(/,/g, " ")
    .trim();
  if (normalized === "") return [];
  const tokens = normalized.split(/\s+/);
  return tokens.map((token) => {
    if (!/^[1-9][0-9]*$/.test(token)) {
      throw new Error(`${name} contains an invalid entry "${token}".`);
    }
    return Number.parseInt(token, 10);
  });
}

export function parseLRSequence(text) {
  const normalized = String(text ?? "")
    .replace(/\\mathcal\{L\}|\\calL|calL/g, " L ")
    .replace(/\\mathcal\{R\}|\\calR|calR/g, " R ")
    .replace(/[()[\]{},]/g, " ")
    .trim();
  if (normalized === "") return [];
  if (/^[LRlr\s]+$/.test(normalized)) {
    return normalized.replace(/\s+/g, "").toUpperCase().split("");
  }
  const tokens = normalized.split(/\s+/);
  return tokens.map((token) => {
    const value = token.toUpperCase();
    if (value !== "L" && value !== "R") {
      throw new Error(`LR sequence contains an invalid entry "${token}".`);
    }
    return value;
  });
}

export function parsePositiveInteger(text, name) {
  const value = Number.parseInt(String(text ?? "").trim(), 10);
  assertPositiveInteger(value, name);
  return value;
}

function previousOrSameWithColor(u, position, color) {
  for (let idx = position; idx >= 1; idx -= 1) {
    if (u[idx - 1] === color) return idx;
  }
  return null;
}

function nextOrSameWithColor(u, position, color) {
  for (let idx = position; idx <= u.length; idx += 1) {
    if (u[idx - 1] === color) return idx;
  }
  return null;
}

export function starA(index, rank) {
  const datum = createDynkinDatum({ family: "A", rank });
  assertPositiveInteger(index, "index");
  if (index > rank) throw new Error(`index ${index} is outside type A_${rank}.`);
  return datum.star.get(index);
}

export function standardHalfTwistWord(rank, family = "A") {
  return createDynkinDatum({ family, rank }).standardHalfTwistWord.slice();
}

export function randomHalfTwistWord(rank, family = "A") {
  return randomHalfTwistWordForDatum(createDynkinDatum({ family, rank }));
}

export function randomExample({ family = "A", rank = null, r = null } = {}) {
  const parsedFamily = normalizeDynkinFamily(family);
  const defaultRank = parsedFamily === "A"
    ? randomInteger(2, 5)
    : parsedFamily === "B" || parsedFamily === "C"
      ? randomInteger(2, 4)
    : parsedFamily === "D"
      ? 4
    : 6;
  const parsedRank = parseOptionalPositiveInteger(rank, "n", defaultRank);
  const datum = createDynkinDatum({ family: parsedFamily, rank: parsedRank });
  const parsedR = parseOptionalPositiveInteger(r, "r", Math.max(2, parsedRank + 2));
  const u = Array.from({ length: parsedR }, () => randomInteger(1, parsedRank));
  const lr = Array.from({ length: parsedR - 1 }, () => (Math.random() < 0.5 ? "L" : "R"));
  const c = lr.filter((move) => move === "L").length + 1;
  return {
    family: parsedFamily,
    rank: String(parsedRank),
    r: String(parsedR),
    u: u.join(" "),
    rxw: (parsedFamily === "B" || parsedFamily === "C" || parsedFamily === "D" || parsedFamily === "E" ? datum.standardHalfTwistWord : randomHalfTwistWordForDatum(datum)).join(" "),
    c: String(c),
    lr: lr.join(" "),
  };
}

function associatedBox(u, envelope, direction) {
  const [left, right] = envelope;
  if (direction === "L") {
    const color = u[left - 1];
    const boxRight = previousOrSameWithColor(u, right, color);
    if (boxRight === null || boxRight < left) {
      throw new Error(`Cannot form [${left},${right}} from the current expression sequence.`);
    }
    return [left, boxRight];
  }
  const color = u[right - 1];
  const boxLeft = nextOrSameWithColor(u, left, color);
  if (boxLeft === null || boxLeft > right) {
    throw new Error(`Cannot form {${left},${right}] from the current expression sequence.`);
  }
  return [boxLeft, right];
}

function intervalText([left, right]) {
  return `[${left},${right}]`;
}

function wrapExpressionText(expr) {
  if (expr === "1" || /^[A-Za-z0-9_]+(\^[0-9]+)?$/.test(expr)) return expr;
  return `(${expr})`;
}

function multiplyExpressionText(...factors) {
  const useful = factors.filter((factor) => factor !== "1");
  if (useful.length === 0) return "1";
  if (useful.includes("0")) return "0";
  return useful.map(wrapExpressionText).join("*");
}

function subtractExpressionText(left, right) {
  if (right === "0") return left;
  if (left === "0") return `-${wrapExpressionText(right)}`;
  return `${wrapExpressionText(left)} - ${wrapExpressionText(right)}`;
}

function divideExpressionText(numerator, denominator) {
  if (denominator === "1") return numerator;
  return `${wrapExpressionText(numerator)}/${wrapExpressionText(denominator)}`;
}

function strictlyNextSameColor(u, index) {
  const color = u[index - 1];
  for (let pos = index + 1; pos <= u.length; pos += 1) {
    if (u[pos - 1] === color) return pos;
  }
  return Infinity;
}

function strictlyPreviousSameColor(u, index) {
  const color = u[index - 1];
  for (let pos = index - 1; pos >= 1; pos -= 1) {
    if (u[pos - 1] === color) return pos;
  }
  return -Infinity;
}

function nearestColorRight(u, index, color) {
  for (let pos = index; pos <= u.length; pos += 1) {
    if (u[pos - 1] === color) return pos;
  }
  return Infinity;
}

function nearestColorLeft(u, index, color) {
  for (let pos = index; pos >= 1; pos -= 1) {
    if (u[pos - 1] === color) return pos;
  }
  return -Infinity;
}

function intervalDisplayOrEmpty(interval) {
  return interval === null ? "∅" : intervalText(interval);
}

function gcdInt(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

function lcmInt(a, b) {
  return Math.abs(a * b) / gcdInt(a, b);
}

function reduceFraction(num, den) {
  if (den < 0) return reduceFraction(-num, -den);
  const divisor = gcdInt(num, den);
  return [num / divisor, den / divisor];
}

function cartanSymmetrizer(datum) {
  const rank = datum?.rank ?? 0;
  const cartan = datum?.cartan ?? [];
  if (rank === 0) return [];
  const values = Array(rank).fill(null);
  values[0] = [1, 1];
  const queue = [0];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const i = queue[cursor];
    for (let j = 0; j < rank; j += 1) {
      if (i === j) continue;
      const cij = cartan[i]?.[j] ?? 0;
      const cji = cartan[j]?.[i] ?? 0;
      if (cij === 0 || cji === 0 || values[j] !== null) continue;
      values[j] = reduceFraction(values[i][0] * Math.abs(cij), values[i][1] * Math.abs(cji));
      queue.push(j);
    }
  }
  const filled = values.map((value) => value ?? [1, 1]);
  const denominator = filled.reduce((acc, [, den]) => lcmInt(acc, den), 1);
  const integers = filled.map(([num, den]) => num * (denominator / den));
  const common = integers.reduce((acc, value) => gcdInt(acc, value), integers[0] || 1);
  return integers.map((value) => value / common);
}

function intervalKeyFromEndpoints(left, right) {
  return `${left},${right}`;
}

function normalizeMatrixValue(value) {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-9) return rounded;
  return Number(value.toFixed(8));
}

function computeAdmissibleChainExchangeMatrix({ datum, u, chain }) {
  const labels = chain.rows.map((row) => `A${row.t}`);
  const intervalSet = new Set(chain.rows.map((row) => intervalKeyFromEndpoints(row.box[0], row.box[1])));
  const frozen = chain.rows.filter((row) => row.frozen).map((row) => `A${row.t}`);
  const frozenSet = new Set(frozen);
  const exchangeable = labels.filter((label) => !frozenSet.has(label));
  const symmetrizerByColor = cartanSymmetrizer(datum);
  const symmetrizerByLabel = Object.fromEntries(chain.rows.map((row) => [
    `A${row.t}`,
    symmetrizerByColor[row.color - 1] ?? 1,
  ]));
  const epsilon = Object.fromEntries(labels.map((label) => [
    label,
    Object.fromEntries(labels.map((other) => [other, 0])),
  ]));

  function hasInterval(left, right) {
    return Number.isFinite(left)
      && Number.isFinite(right)
      && intervalSet.has(intervalKeyFromEndpoints(left, right));
  }

  function positiveEntry(row, other) {
    if (row.t === other.t) return 0;
    const [x, y] = row.box;
    const [xp, yp] = other.box;
    const yMinus = strictlyPreviousSameColor(u, y);
    const xMinus = strictlyPreviousSameColor(u, x);
    if ((x === xp && yp === yMinus) || (y === yp && xp === xMinus)) return 1;

    const cartanEntry = datum.cartan[row.color - 1]?.[other.color - 1] ?? 0;
    if (cartanEntry >= 0) return 0;

    const yPlus = strictlyNextSameColor(u, y);
    const xpMinus = strictlyPreviousSameColor(u, xp);
    const ypPlus = strictlyNextSameColor(u, yp);
    const xIsEffective = row.effectiveEnd === x;
    const ypIsEffective = other.effectiveEnd === yp;
    const hasRightExpansion = hasInterval(x, yPlus);
    const hasLeftExpansionOfOther = hasInterval(xpMinus, yp);
    const caseA = hasRightExpansion
      && xIsEffective
      && xpMinus < x && x < xp
      && yp < yPlus && yPlus < ypPlus;
    const caseB = hasRightExpansion
      && ypIsEffective
      && xpMinus < x
      && y < yp && yp < yPlus && yPlus < ypPlus;
    const caseC = hasLeftExpansionOfOther
      && ypIsEffective
      && xMinus < xpMinus && xpMinus < x
      && y < yp && yp < yPlus;
    const caseD = hasLeftExpansionOfOther
      && xIsEffective
      && xMinus < xpMinus && xpMinus < x && x < xp
      && yp < yPlus;
    return caseA || caseB || caseC || caseD ? -cartanEntry : 0;
  }

  function setPositiveEntry(row, other, value) {
    if (value <= 0) return;
    const rowLabel = `A${row.t}`;
    const otherLabel = `A${other.t}`;
    const dRow = symmetrizerByLabel[rowLabel] ?? 1;
    const dOther = symmetrizerByLabel[otherLabel] ?? 1;
    epsilon[rowLabel][otherLabel] = value;
    epsilon[otherLabel][rowLabel] = normalizeMatrixValue(-(dRow * value) / dOther);
  }

  chain.rows.forEach((row) => {
    chain.rows.forEach((other) => {
      setPositiveEntry(row, other, positiveEntry(row, other));
    });
  });

  const arrows = [];
  const arrowKeys = new Set();
  labels.forEach((rowLabel) => {
    exchangeable.forEach((colLabel) => {
      if (rowLabel === colLabel) return;
      const raw = epsilon[rowLabel]?.[colLabel] ?? 0;
      if (Math.abs(raw) < 1e-9) return;
      const source = raw > 0 ? rowLabel : colLabel;
      const target = raw > 0 ? colLabel : rowLabel;
      const rowSymmetrizer = symmetrizerByLabel[rowLabel] ?? 1;
      const sourceSymmetrizer = symmetrizerByLabel[source] ?? 1;
      const columnValue = Math.abs(raw);
      const sourceValue = raw > 0
        ? columnValue
        : normalizeMatrixValue((rowSymmetrizer * columnValue) / sourceSymmetrizer);
      const key = `${source}->${target}`;
      if (arrowKeys.has(key)) return;
      arrowKeys.add(key);
      arrows.push({
        source,
        target,
        weight: normalizeMatrixValue(rowSymmetrizer * columnValue),
        matrixEntry: sourceValue,
      });
    });
  });

  return {
    labels,
    columnLabels: exchangeable,
    epsilon,
    arrows,
    frozen,
    exchangeable,
    colors: Object.fromEntries(chain.rows.map((row) => [`A${row.t}`, row.color])),
    ordinaryQuiver: datum.cartan.every((cartanRow, i) => (
      cartanRow.every((entry, j) => i === j || entry === 0 || entry === -1)
    )),
    source: "KK24 admissible-chain exchange matrix",
    symmetrizer: labels.map((label) => symmetrizerByLabel[label] ?? 1),
    symmetrizerByLabel,
  };
}

function unfoldBGeneratorToSimplyLaced(generator, rank) {
  if (rank === 2) return generator === 2 ? [1, 3] : [2];
  return generator === rank ? [rank, rank + 1] : [generator];
}

function unfoldBSequenceToSimplyLacedWithSource(sequence, rank, sourcePrefix) {
  const word = [];
  const sourceSubstitution = {};
  sequence.forEach((generator, sourceIdx) => {
    unfoldBGeneratorToSimplyLaced(generator, rank).forEach((liftedGenerator) => {
      word.push(liftedGenerator);
      sourceSubstitution[`${sourcePrefix}${word.length}`] = `${sourcePrefix}${sourceIdx + 1}`;
    });
  });
  return { word, sourceSubstitution };
}

function unfoldBDoubleStringToSimplyLaced(doubleString, rank) {
  const entries = [];
  const dStepToBStep = [];
  doubleString.forEach((entry, idx) => {
    unfoldBGeneratorToSimplyLaced(entry.h, rank).forEach((liftedGenerator) => {
      entries.push({
        ...entry,
        h: liftedGenerator,
      });
      dStepToBStep.push(idx + 1);
    });
  });
  return { entries, dStepToBStep };
}

function createBUnfoldedDatum(rank) {
  return rank === 2
    ? createDynkinDatum({ family: "A", rank: 3 })
    : createDynkinDatum({ family: "D", rank: rank + 1 });
}

function computeFoldedBWeaveClusterValues({ rank, rxw, u, c, doubleString, bottomWeave }) {
  const foldedRxw = unfoldBSequenceToSimplyLacedWithSource(rxw, rank, "w");
  const foldedU = unfoldBSequenceToSimplyLacedWithSource(u, rank, "z");
  const sourceSubstitution = {
    ...foldedRxw.sourceSubstitution,
    ...foldedU.sourceSubstitution,
  };
  const foldedPrefixLength = u.slice(0, c - 1)
    .reduce((total, generator) => total + unfoldBGeneratorToSimplyLaced(generator, rank).length, 0);
  const dDatum = createBUnfoldedDatum(rank);
  const dTopWeave = buildTopWeave({
    datum: dDatum,
    rxw: foldedRxw.word,
    u: foldedU.word,
    c: foldedPrefixLength + 1,
  });
  const ySubstitution = Object.fromEntries(
    Object.entries(dTopWeave.coordinateSubstitution ?? {}).map(([name, expression]) => [
      name,
      expandExpressionText(expression, sourceSubstitution),
    ]),
  );
  const { entries: dDoubleString, dStepToBStep } = unfoldBDoubleStringToSimplyLaced(doubleString, rank);
  const dBottomWeave = buildDoubleInductiveWeave(dDoubleString, dDatum);
  const dValues = computeFullClusterValues(dBottomWeave.clusterValues, ySubstitution);
  const bLabelByStep = new Map((bottomWeave.clusterValues ?? []).map((value) => [value.step, value.label]));
  const liftsByBStep = new Map();
  const liftsByBLabel = new Map();
  dValues.forEach((value) => {
    const bStep = dStepToBStep[value.step - 1];
    if (!bStep) return;
    if (!liftsByBStep.has(bStep)) liftsByBStep.set(bStep, []);
    liftsByBStep.get(bStep).push(value);
    const bLabel = bLabelByStep.get(bStep);
    if (!bLabel) return;
    if (!liftsByBLabel.has(bLabel)) liftsByBLabel.set(bLabel, []);
    liftsByBLabel.get(bLabel).push(value.label);
  });

  const clusterValues = (bottomWeave.clusterValues ?? []).map((value) => {
    const lifts = liftsByBStep.get(value.step) ?? [];
    if (lifts.length === 0) {
      return {
        ...value,
        expression: "",
        expansionWarning: "No unfolded simply-laced lift was found for this trivalent vertex.",
      };
    }
    return {
      ...value,
      expression: lifts[0].expression,
      middleExpression: lifts[0].middleExpression ?? lifts[0].expression,
      expansionWarning: lifts[0].substitutionWarning ?? lifts[0].expansionWarning ?? "",
      foldedLiftLabels: lifts.map((lift) => lift.label),
      foldedLiftExpressions: lifts.map((lift) => lift.expression),
    };
  });
  const labels = bottomWeave.quiverData?.labels ?? clusterValues.map((value) => value.label);
  const frozen = bottomWeave.quiverData?.frozen ?? [];
  const frozenSet = new Set(frozen);
  const epsilon = Object.fromEntries(labels.map((rowLabel) => [
    rowLabel,
    Object.fromEntries(labels.map((colLabel) => {
      const rowLifts = liftsByBLabel.get(rowLabel) ?? [];
      const colLifts = liftsByBLabel.get(colLabel) ?? [];
      if (rowLifts.length === 0 || colLifts.length === 0) return [colLabel, 0];
      const total = rowLifts.reduce((rowTotal, rowLift) => (
        rowTotal + colLifts.reduce((colTotal, colLift) => (
          colTotal + Number(dBottomWeave.quiverData.epsilon?.[rowLift]?.[colLift] ?? 0)
        ), 0)
      ), 0);
      return [colLabel, total / rowLifts.length];
    })),
  ]));
  const arrows = [];
  const symmetrizerByLabel = Object.fromEntries(labels.map((label, idx) => [
    label,
    bottomWeave.quiverData?.symmetrizer?.[idx] ?? 1,
  ]));
  labels.forEach((source) => {
    labels.forEach((target) => {
      if (source === target || (frozenSet.has(source) && frozenSet.has(target))) return;
      const value = Number(epsilon[source]?.[target] ?? 0);
      if (value <= 0) return;
      arrows.push({
        source,
        target,
        weight: normalizeMatrixValue((symmetrizerByLabel[source] ?? 1) * value),
        matrixEntry: value,
        contributions: [{
          kind: "folding",
          value,
          numericValue: value,
        }],
      });
    });
  });
  const foldedQuiverData = {
    ...(bottomWeave.quiverData ?? {}),
    labels,
    epsilon,
    arrows,
    frozen,
    exchangeable: labels.filter((label) => !frozenSet.has(label)),
    ordinaryQuiver: false,
    cycleOverlayAvailable: false,
    intersectionEvidenceAvailable: false,
    source: "CGG unfolding/folding exchange matrix",
    foldedLiftLabels: Object.fromEntries(labels.map((label) => [label, liftsByBLabel.get(label) ?? []])),
    symmetrizerByLabel,
  };

  return {
    clusterValues,
    quiverData: foldedQuiverData,
    unfoldedType: rank === 2 ? "A_3" : `D_${rank + 1}`,
    unfoldedClusterCount: dValues.length,
  };
}

function unfoldCGeneratorToSimplyLaced(generator, rank) {
  return generator === rank ? [rank] : [generator, 2 * rank - generator];
}

function unfoldCSequenceToSimplyLacedWithSource(sequence, rank, sourcePrefix) {
  const word = [];
  const sourceSubstitution = {};
  sequence.forEach((generator, sourceIdx) => {
    unfoldCGeneratorToSimplyLaced(generator, rank).forEach((liftedGenerator) => {
      word.push(liftedGenerator);
      sourceSubstitution[`${sourcePrefix}${word.length}`] = `${sourcePrefix}${sourceIdx + 1}`;
    });
  });
  return { word, sourceSubstitution };
}

function unfoldCDoubleStringToSimplyLaced(doubleString, rank) {
  const entries = [];
  const aStepToCStep = [];
  doubleString.forEach((entry, idx) => {
    unfoldCGeneratorToSimplyLaced(entry.h, rank).forEach((liftedGenerator) => {
      entries.push({
        ...entry,
        h: liftedGenerator,
      });
      aStepToCStep.push(idx + 1);
    });
  });
  return { entries, aStepToCStep };
}

function computeFoldedCWeaveClusterValues({ rank, rxw, u, c, doubleString, bottomWeave }) {
  const foldedRxw = unfoldCSequenceToSimplyLacedWithSource(rxw, rank, "w");
  const foldedU = unfoldCSequenceToSimplyLacedWithSource(u, rank, "z");
  const sourceSubstitution = {
    ...foldedRxw.sourceSubstitution,
    ...foldedU.sourceSubstitution,
  };
  const foldedPrefixLength = u.slice(0, c - 1)
    .reduce((total, generator) => total + unfoldCGeneratorToSimplyLaced(generator, rank).length, 0);
  const aDatum = createDynkinDatum({ family: "A", rank: 2 * rank - 1 });
  const aTopWeave = buildTopWeave({
    datum: aDatum,
    rxw: foldedRxw.word,
    u: foldedU.word,
    c: foldedPrefixLength + 1,
  });
  const ySubstitution = Object.fromEntries(
    Object.entries(aTopWeave.coordinateSubstitution ?? {}).map(([name, expression]) => [
      name,
      expandExpressionText(expression, sourceSubstitution),
    ]),
  );
  const { entries: aDoubleString, aStepToCStep } = unfoldCDoubleStringToSimplyLaced(doubleString, rank);
  const aBottomWeave = buildDoubleInductiveWeave(aDoubleString, aDatum);
  const aValues = computeFullClusterValues(aBottomWeave.clusterValues, ySubstitution);
  const cLabelByStep = new Map((bottomWeave.clusterValues ?? []).map((value) => [value.step, value.label]));
  const liftsByCStep = new Map();
  const liftsByCLabel = new Map();
  aValues.forEach((value) => {
    const cStep = aStepToCStep[value.step - 1];
    if (!cStep) return;
    if (!liftsByCStep.has(cStep)) liftsByCStep.set(cStep, []);
    liftsByCStep.get(cStep).push(value);
    const cLabel = cLabelByStep.get(cStep);
    if (!cLabel) return;
    if (!liftsByCLabel.has(cLabel)) liftsByCLabel.set(cLabel, []);
    liftsByCLabel.get(cLabel).push(value.label);
  });

  const clusterValues = (bottomWeave.clusterValues ?? []).map((value) => {
    const lifts = liftsByCStep.get(value.step) ?? [];
    if (lifts.length === 0) {
      return {
        ...value,
        expression: "",
        expansionWarning: "No unfolded simply-laced lift was found for this trivalent vertex.",
      };
    }
    return {
      ...value,
      expression: lifts[0].expression,
      middleExpression: lifts[0].middleExpression ?? lifts[0].expression,
      expansionWarning: lifts[0].substitutionWarning ?? lifts[0].expansionWarning ?? "",
      foldedLiftLabels: lifts.map((lift) => lift.label),
      foldedLiftExpressions: lifts.map((lift) => lift.expression),
    };
  });
  const labels = bottomWeave.quiverData?.labels ?? clusterValues.map((value) => value.label);
  const frozen = bottomWeave.quiverData?.frozen ?? [];
  const frozenSet = new Set(frozen);
  const epsilon = Object.fromEntries(labels.map((rowLabel) => [
    rowLabel,
    Object.fromEntries(labels.map((colLabel) => {
      const rowLifts = liftsByCLabel.get(rowLabel) ?? [];
      const colLifts = liftsByCLabel.get(colLabel) ?? [];
      if (rowLifts.length === 0 || colLifts.length === 0) return [colLabel, 0];
      const total = rowLifts.reduce((rowTotal, rowLift) => (
        rowTotal + colLifts.reduce((colTotal, colLift) => (
          colTotal + Number(aBottomWeave.quiverData.epsilon?.[rowLift]?.[colLift] ?? 0)
        ), 0)
      ), 0);
      return [colLabel, total / rowLifts.length];
    })),
  ]));
  const arrows = [];
  const symmetrizerByLabel = Object.fromEntries(labels.map((label, idx) => [
    label,
    bottomWeave.quiverData?.symmetrizer?.[idx] ?? 1,
  ]));
  labels.forEach((source) => {
    labels.forEach((target) => {
      if (source === target || (frozenSet.has(source) && frozenSet.has(target))) return;
      const value = Number(epsilon[source]?.[target] ?? 0);
      if (value <= 0) return;
      arrows.push({
        source,
        target,
        weight: normalizeMatrixValue((symmetrizerByLabel[source] ?? 1) * value),
        matrixEntry: value,
        contributions: [{
          kind: "folding",
          value,
          numericValue: value,
        }],
      });
    });
  });
  const foldedQuiverData = {
    ...(bottomWeave.quiverData ?? {}),
    labels,
    epsilon,
    arrows,
    frozen,
    exchangeable: labels.filter((label) => !frozenSet.has(label)),
    ordinaryQuiver: false,
    cycleOverlayAvailable: false,
    intersectionEvidenceAvailable: false,
    source: "CGG unfolding/folding exchange matrix",
    foldedLiftLabels: Object.fromEntries(labels.map((label) => [label, liftsByCLabel.get(label) ?? []])),
    symmetrizerByLabel,
  };

  return {
    clusterValues,
    quiverData: foldedQuiverData,
    unfoldedType: `A_${2 * rank - 1}`,
    unfoldedClusterCount: aValues.length,
  };
}

function computeDeterminantialModules({ datum, u, chain }) {
  const memo = new Map();
  const data = new Map();

  function adjacentColors(color) {
    return datum.cartan[color - 1]
      .map((entry, idx) => ({ color: idx + 1, exponent: Math.max(0, -entry) }))
      .filter((item) => item.exponent > 0);
  }

  function normalizeInterval(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return null;
    return [a, b];
  }

  function intervalKey(interval) {
    return interval === null ? "empty" : `${interval[0]},${interval[1]}`;
  }

  function compute(interval) {
    if (interval === null) return {
      interval,
      expression: "1",
      base: true,
      empty: true,
    };
    const [a, b] = interval;
    const cacheKey = intervalKey(interval);
    if (memo.has(cacheKey)) return memo.get(cacheKey);
    if (u[a - 1] !== u[b - 1]) {
      throw new Error(`Cannot compute M${intervalText(interval)} because it is not an i-box.`);
    }

    let result;
    if (a === b) {
      result = {
        interval,
        expression: `C_${a}`,
        base: true,
        empty: false,
      };
    } else {
      const inner = normalizeInterval(strictlyNextSameColor(u, a), strictlyPreviousSameColor(u, b));
      const left = normalizeInterval(strictlyNextSameColor(u, a), b);
      const right = normalizeInterval(a, strictlyPreviousSameColor(u, b));
      const correctionIntervals = adjacentColors(u[a - 1])
        .map(({ color, exponent }) => ({
          interval: normalizeInterval(nearestColorRight(u, a, color), nearestColorLeft(u, b, color)),
          exponent,
        }))
        .filter((item) => item.interval !== null);

      const leftData = compute(left);
      const rightData = compute(right);
      const innerData = compute(inner);
      const correctionData = correctionIntervals.map((item) => ({
        ...item,
        data: compute(item.interval),
      }));
      const correction = multiplyExpressionText(...correctionData.map((item) => (
        item.exponent === 1
          ? item.data.expression
          : `(${item.data.expression})^${item.exponent}`
      )));
      const numerator = subtractExpressionText(
        multiplyExpressionText(leftData.expression, rightData.expression),
        correction,
      );
      let expression;
      try {
        expression = expandExpressionText(divideExpressionText(numerator, innerData.expression));
      } catch {
        expression = divideExpressionText(numerator, innerData.expression);
      }
      result = {
        interval,
        expression,
        base: false,
        empty: false,
        left,
        right,
        inner,
        correctionIntervals,
        leftExpression: leftData.expression,
        rightExpression: rightData.expression,
        innerExpression: innerData.expression,
        correctionExpression: correction,
      };
    }
    memo.set(cacheKey, result);
    data.set(cacheKey, result);
    return result;
  }

  const rows = chain.rows.map((row) => {
    const value = compute(row.box);
    return {
      t: row.t,
      interval: row.box.slice(),
      color: row.color,
      expression: value.expression,
      calculation: value,
    };
  });

  return {
    rows,
    all: [...data.values()].filter((item) => !item.empty),
    intervalDisplay: intervalDisplayOrEmpty,
  };
}

export function makeAdmissibleChain({ datum, u, c, lr }) {
  const r = u.length;
  if (r === 0) throw new Error("u must be nonempty.");
  validateSequenceInDynkin(u, datum, "u");
  if (lr.length !== r - 1) {
    throw new Error(`LR sequence must have length ${r - 1}, but has length ${lr.length}.`);
  }

  const expectedC = lr.filter((move) => move === "L").length + 1;
  if (c !== expectedC) {
    throw new Error(`For this LR sequence, the initial envelope must be c=${expectedC}.`);
  }

  const firstByColor = new Map();
  const lastByColor = new Map();
  u.forEach((color, idx) => {
    const pos = idx + 1;
    if (!firstByColor.has(color)) firstByColor.set(color, pos);
    lastByColor.set(color, pos);
  });

  let envelope = [c, c];
  const rows = [];
  for (let t = 1; t <= r; t += 1) {
    const previousMove = t === 1 ? "R" : lr[t - 2];
    if (t > 1) {
      if (previousMove === "L") envelope = [envelope[0] - 1, envelope[1]];
      else envelope = [envelope[0], envelope[1] + 1];
    }
    if (envelope[0] < 1 || envelope[1] > r) {
      throw new Error(`Envelope ${intervalText(envelope)} is outside [1,${r}].`);
    }
    const effectiveEnd = t === 1 ? c : (previousMove === "L" ? envelope[0] : envelope[1]);
    const box = associatedBox(u, envelope, previousMove);
    const color = u[box[0] - 1];
    if (u[box[1] - 1] !== color) {
      throw new Error(`Internal error: ${intervalText(box)} is not an i-box.`);
    }
    const side = previousMove === "L" ? "L" : "R";
    const h = side === "L" ? datum.star.get(color) : color;
    rows.push({
      t,
      previousMove,
      envelope: envelope.slice(),
      effectiveEnd,
      box,
      color,
      frozen: box[0] === firstByColor.get(color) && box[1] === lastByColor.get(color),
      h,
      side,
      boxNotation: previousMove === "L"
        ? `[${envelope[0]},${envelope[1]}}`
        : `{${envelope[0]},${envelope[1]}]`,
    });
  }

  return {
    family: datum.family,
    rank: datum.rank,
    dynkin: datum,
    u: u.slice(),
    c,
    lr: lr.slice(),
    range: rows[rows.length - 1].envelope.slice(),
    rows,
  };
}

export function makeDoubleString({ datum, rxw, chain }) {
  validateSequenceInDynkin(rxw, datum, "rxw");
  const prefix = rxw.map((entry, idx) => ({
    source: "rxw",
    t: idx + 1,
    h: entry,
    side: "R",
    plus: true,
  }));
  const chainEntries = chain.rows.map((row) => ({
    source: "chain",
    t: row.t,
    h: row.h,
    side: row.side,
    plus: false,
    color: row.color,
    box: row.box.slice(),
  }));
  return [...prefix, ...chainEntries];
}

export function sequenceFromDoubleString(doubleString) {
  const out = [];
  doubleString.forEach((entry) => {
    if (entry.side === "L") out.unshift(entry.h);
    else out.push(entry.h);
  });
  return out;
}

export function summarizeDoubleString(doubleString, rxwLength) {
  const prefix = doubleString.slice(0, rxwLength);
  const chainEntries = doubleString.slice(rxwLength);
  return {
    prefix,
    chainEntries,
    leftPart: chainEntries.filter((entry) => entry.side === "L").reverse().map((entry) => entry.h),
    rightPart: chainEntries.filter((entry) => entry.side === "R").map((entry) => entry.h),
    uiSequence: sequenceFromDoubleString(doubleString),
  };
}

export function formatDoubleStringEntry(entry) {
  return `${entry.h}${entry.side}${entry.plus ? "+" : ""}`;
}

export function buildTrace(input) {
  const family = normalizeDynkinFamily(input.family ?? input.type ?? "A");
  const rank = parsePositiveInteger(input.rank, "rank");
  const datum = createDynkinDatum({ family, rank });
  const u = parseIntegerSequence(input.u, "u");
  const rxw = parseIntegerSequence(input.rxw, "rxw");
  const lr = parseLRSequence(input.lr);
  const c = input.c === "" || input.c === null || input.c === undefined
    ? lr.filter((move) => move === "L").length + 1
    : parsePositiveInteger(input.c, "c");
  const chain = makeAdmissibleChain({ datum, u, c, lr });
  chain.exchangeMatrix = computeAdmissibleChainExchangeMatrix({ datum, u, chain });
  const determinantialModules = computeDeterminantialModules({ datum, u, chain });
  const doubleString = makeDoubleString({ datum, rxw, chain });
  const doubleSummary = summarizeDoubleString(doubleString, rxw.length);
  if (family === "D" && datum.positiveRoots.length > 20) {
    throw new Error(`The reduced expression Δ̲ for ${datum.label} is computed, but rendering D_6 and higher currently requires an optimized braid-path algorithm. The public page supports D_4 and D_5 reliably.`);
  }
  if (family === "B" && datum.positiveRoots.length > 16) {
    throw new Error(`The reduced expression Δ̲ for ${datum.label} is computed, but rendering B_5 and higher currently requires a larger braid-path budget. The public page supports B_2, B_3, and B_4 reliably.`);
  }
  if (family === "C" && datum.positiveRoots.length > 16) {
    throw new Error(`The reduced expression Δ̲ for ${datum.label} is computed, but rendering C_5 and higher currently requires a larger braid-path budget. The public page supports C_2, C_3, and C_4 reliably.`);
  }
  if (family === "E" && (rank !== 6 || input.experimentalE !== true)) {
    throw new Error(`The reduced expression Δ̲ for ${datum.label} has been computed, but browser rendering is currently enabled only for type A, type D, and preset type E_6 experiments.`);
  }
  if (family !== "A" && family !== "B" && family !== "C" && family !== "D" && family !== "E") {
    throw new Error(`The reduced expression Δ̲ for ${datum.label} has been computed, but browser rendering is currently enabled only for type A, type B, type C, and type D.`);
  }
  const topWeave = buildTopWeave({ datum, rxw, u, c });
  const bottomWeave = buildDoubleInductiveWeave(doubleString, datum);
  const foldedClusterComputation = family === "B"
    ? computeFoldedBWeaveClusterValues({ rank, rxw, u, c, doubleString, bottomWeave })
    : family === "C"
      ? computeFoldedCWeaveClusterValues({ rank, rxw, u, c, doubleString, bottomWeave })
    : null;
  if (foldedClusterComputation) {
    bottomWeave.clusterValues = foldedClusterComputation.clusterValues;
    bottomWeave.quiverData = foldedClusterComputation.quiverData;
  }
  const shouldExpandFullClusterValues = !foldedClusterComputation
    && bottomWeave.coordinateAvailable
    && u.length <= 12
    && bottomWeave.clusterValues.length <= 12;
  const fullClusterValues = shouldExpandFullClusterValues
    ? computeFullClusterValues(bottomWeave.clusterValues, topWeave.coordinateSubstitution)
    : foldedClusterComputation
      ? foldedClusterComputation.clusterValues
    : [];
  return {
    family,
    dynkin: datum,
    rank,
    u,
    rxw,
    c,
    expectedC: lr.filter((move) => move === "L").length + 1,
    lr,
    chain,
    determinantialModules,
    doubleString,
    doubleSummary,
    topWeave,
    bottomWeave,
    foldedClusterComputation,
    fullClusterValues,
    fullClusterValuesOmitted: !shouldExpandFullClusterValues && !foldedClusterComputation,
    fullClusterValuesOmittedReason: foldedClusterComputation
      ? ""
      : bottomWeave.coordinateAvailable
      ? "The expanded expression is large."
      : family === "B" || family === "C"
        ? "Generalized dual Lusztig-cycle coordinate formulas are not implemented for non-simply-laced type."
        : "Coordinate formulas are not implemented for this type.",
  };
}

export function intervalTextForDisplay(interval) {
  return intervalText(interval);
}
