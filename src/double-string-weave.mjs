import { createDynkinDatum, normalizeDynkinFamily, validateSequenceInDynkin } from "./dynkin.mjs?v=20260708-double-string-zfull";
import { buildDoubleInductiveWeave } from "./weave.mjs?v=20260708-double-string-zfull";
import { renderTrace } from "./render.mjs?v=20260708-double-string-zfull";

const form = document.querySelector("#input-form");
const familyInput = document.querySelector("#family-input");
const rankInput = document.querySelector("#rank-input");
const doubleStringInput = document.querySelector("#double-string-input");
const randomLengthInput = document.querySelector("#random-length-input");
const output = document.querySelector("#output");
const errorBox = document.querySelector("#error-box");
const exampleAButton = document.querySelector("#example-a-button");
const exampleMixedButton = document.querySelector("#example-mixed-button");
const randomButton = document.querySelector("#random-button");

const defaultExample = {
  family: "A",
  rank: "3",
  doubleString: "2L 1L 3L 2L 1L 2L 3L 2L 1L",
};

const mixedExample = {
  family: "A",
  rank: "4",
  doubleString: "2L 1R 3R 1L 2L 2R",
};

function parsePositiveInteger(text, name) {
  const value = Number.parseInt(String(text ?? "").trim(), 10);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
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
        step: idx + 1,
      });
      continue;
    }
    const split = /^([1-9][0-9]*)$/.exec(token);
    const next = tokens[idx + 1] ?? "";
    const side = /^([LRlr])(\+)?$/.exec(next);
    if (split && side) {
      entries.push({
        h: Number.parseInt(split[1], 10),
        side: side[1].toUpperCase(),
        plus: side[2] === "+",
        step: entries.length + 1,
      });
      idx += 1;
      continue;
    }
    throw new Error(`Invalid double string entry "${token}". Use entries like 1L, 2R, or 1L+.`);
  }
  return entries.map((entry, idx) => ({ ...entry, step: idx + 1 }));
}

function formatEntry(entry) {
  return `${entry.h}${entry.side}${entry.plus ? "+" : ""}`;
}

function randomInteger(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomSide() {
  return Math.random() < 0.5 ? "L" : "R";
}

function randomDoubleStringText(dynkin, length) {
  return Array.from({ length }, () => `${randomInteger(1, dynkin.rank)}${randomSide()}`).join(" ");
}

function buildDoubleStringTrace(input) {
  const family = normalizeDynkinFamily(input.family);
  const rank = parsePositiveInteger(input.rank, "rank");
  const dynkin = createDynkinDatum({ family, rank });
  const parsedDoubleString = parseDoubleString(input.doubleString);
  validateSequenceInDynkin(parsedDoubleString.map((entry) => entry.h), dynkin, "double string");

  const firstPass = buildDoubleInductiveWeave(parsedDoubleString, dynkin);
  const doubleString = parsedDoubleString.map((entry, idx) => ({
    ...entry,
    plus: firstPass.stepInfos[idx]?.plus ?? entry.plus,
    source: "double-string",
  }));
  const bottomWeave = buildDoubleInductiveWeave(doubleString, dynkin, { coordinatePrefix: "z" });
  const topBoundaryWord = bottomWeave.words[0]?.slice() ?? [];
  const topCoordinates = topBoundaryWord.map((_, idx) => `z${idx + 1}`);
  const topWeave = {
    words: [topBoundaryWord],
    moves: [],
    sourceWord: topBoundaryWord.slice(),
    sourceCoordinates: topCoordinates,
    coordinateRows: [topCoordinates],
    coordinateSubstitution: {},
  };

  return {
    mode: "double-string",
    family,
    dynkin,
    rank,
    doubleString,
    topWeave,
    bottomWeave,
    fullClusterValues: bottomWeave.coordinateAvailable ? bottomWeave.clusterValues ?? [] : [],
    fullClusterValuesOmitted: !bottomWeave.coordinateAvailable,
    fullClusterValuesOmittedReason: bottomWeave.coordinateAvailable
      ? ""
      : "Coordinate formulas are not implemented for this type in the standalone double-string page.",
    weaveTitle: "𝒲(s)",
    weaveSubtitle: "𝒲(s) is the double inductive weave attached to the input double string s.",
    junctionLabel: "s",
    quiverLabel: "Q(𝒲(s))",
    matrixLabel: "B(Q(𝒲(s)))",
    variableHeader: "A_t = A_t(𝒲(s))",
  };
}

function readInput() {
  return {
    family: familyInput.value,
    rank: rankInput.value,
    doubleString: doubleStringInput.value,
  };
}

function writeInput(values) {
  familyInput.value = values.family;
  rankInput.value = values.rank;
  doubleStringInput.value = values.doubleString;
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
  const url = new URL(window.location.href);
  url.searchParams.set("family", trace.family);
  url.searchParams.set("rank", String(trace.rank));
  url.searchParams.set("s", trace.doubleString.map(formatEntry).join(" "));
  url.searchParams.delete("cluster");
  url.searchParams.delete("arrow");
  window.history.replaceState(null, "", url);
}

function inputFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const family = params.get("family");
    const rank = params.get("rank");
    const doubleString = params.get("s") ?? params.get("doubleString");
    if (!family && !rank && !doubleString) return null;
    return {
      family: family ?? defaultExample.family,
      rank: rank ?? defaultExample.rank,
      doubleString: doubleString ?? defaultExample.doubleString,
    };
  } catch {
    return null;
  }
}

function runConstruction({ preserveUrl = false } = {}) {
  try {
    clearError();
    const trace = buildDoubleStringTrace(readInput());
    doubleStringInput.value = trace.doubleString.map(formatEntry).join(" ");
    renderTrace(trace, output);
    if (!preserveUrl) syncUrl(trace);
  } catch (error) {
    output.replaceChildren();
    setError(error instanceof Error ? error.message : String(error));
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runConstruction();
});

exampleAButton.addEventListener("click", () => {
  writeInput(defaultExample);
  runConstruction();
});

exampleMixedButton.addEventListener("click", () => {
  writeInput(mixedExample);
  runConstruction();
});

randomButton.addEventListener("click", () => {
  try {
    clearError();
    const family = normalizeDynkinFamily(familyInput.value);
    const rank = parsePositiveInteger(rankInput.value, "rank");
    const length = parsePositiveInteger(randomLengthInput.value, "random length");
    if (length > 24) throw new Error("random length must be at most 24.");
    const dynkin = createDynkinDatum({ family, rank });
    doubleStringInput.value = randomDoubleStringText(dynkin, length);
    runConstruction();
  } catch (error) {
    output.replaceChildren();
    setError(error instanceof Error ? error.message : String(error));
  }
});

writeInput(inputFromUrl() ?? defaultExample);
runConstruction({ preserveUrl: Boolean(inputFromUrl()) });
