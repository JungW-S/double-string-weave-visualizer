import { createDynkinDatum } from "./dynkin.mjs?v=20260708-richardson-layered-fix19";
import { buildDoubleInductiveWeave } from "./weave.mjs?v=20260708-richardson-layered-fix19";
import {
  cycleColor,
  renderClusterVariableAnswerPanel,
  renderInteractiveWeaveViewer,
  renderQuiverAnswerPanel,
} from "./render.mjs?v=20260708-richardson-layered-fix19";

const form = document.querySelector("#input-form");
const rankInput = document.querySelector("#rank-input");
const wInput = document.querySelector("#w-input");
const vInput = document.querySelector("#v-input");
const layerInput = document.querySelector("#layer-input");
const layerOutput = document.querySelector("#layer-output");
const output = document.querySelector("#output");
const errorBox = document.querySelector("#error-box");
const exampleA2Button = document.querySelector("#example-a2-button");
const exampleA3Button = document.querySelector("#example-a3-button");

const examples = {
  a2: {
    rank: "2",
    w: "1 2 1",
    v: "2",
  },
  a3: {
    rank: "3",
    w: "1 2 1 3 2",
    v: "3",
  },
};

let currentData = null;
let currentT = 0;
let currentActiveLayer = 0;

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

function svgEl(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
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

function ricStringLabel(t) {
  return `sᴸ_Ric(t=${t})`;
}

function ricWeaveLabel(t) {
  return `𝒲ᴸ_Ric(t=${t})`;
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

function inverseAction(action) {
  const out = Array(action.length);
  action.forEach((value, idx) => {
    out[value - 1] = idx + 1;
  });
  return out;
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

function actionKey(action) {
  return action.join(",");
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

function sameCoxeterElement(leftWord, rightWord, rank) {
  return sameAction(actionOfWord(leftWord, rank), actionOfWord(rightWord, rank));
}

function isReducedTypeAWord(word, rank) {
  return coxeterLengthOfAction(actionOfWord(word, rank)) === word.length;
}

function textWord(word) {
  return word.length === 0 ? "e" : word.join("");
}

function displayWordFromIndexedPrefix(word, t = word.length) {
  return word.slice(0, t);
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

function rightmostRepresentativePositions({ vWord, indexedWord, rank }) {
  if (vWord.length === 0) return { positions: [], word: [] };
  for (const positions of combinationsOfSize(indexedWord.length, vWord.length).reverse()) {
    const displayedSubword = positions.map((position) => indexedWord[position - 1]);
    if (sameCoxeterElement(displayedSubword, vWord, rank)) {
      return { positions, word: displayedSubword };
    }
  }
  throw new Error("No CGGLS rightmost representative of v was found in the indexed word.");
}

function starGeneratorTypeA(generator, rank) {
  return rank + 1 - generator;
}

function starWord(word, rank) {
  return word.map((generator) => starGeneratorTypeA(generator, rank));
}

function complementWordForVStar(vStarWord, rank) {
  const complementAction = multiplyActions(longestAction(rank), inverseAction(actionOfWord(vStarWord, rank)));
  return reducedWordForAction(complementAction);
}

function makeLeftRichardsonDoubleString({ vcWord, indexedWord, plusPositions }) {
  const plusSet = new Set(plusPositions);
  return [
    ...vcWord.slice().reverse().map((generator, idx) => ({
      source: "vc",
      block: "v^c",
      t: vcWord.length - idx,
      h: generator,
      side: "L",
      plus: true,
    })),
    ...indexedWord.slice().reverse().map((generator, idx) => {
      const position = indexedWord.length - idx;
      return {
        source: plusSet.has(position) ? "w-plus" : "w-free",
        block: "w",
        t: position,
        wPosition: position,
        h: generator,
        side: "L",
        plus: plusSet.has(position),
      };
    }),
  ].map((entry, idx) => ({ ...entry, step: idx + 1 }));
}

function buildPartialRichardsonData({ rank, indexedWord, plusPositions }, t) {
  const partialWord = indexedWord.slice(0, t);
  const partialPlusPositions = plusPositions.filter((position) => position <= t);
  const partialVWord = partialPlusPositions.map((position) => indexedWord[position - 1]);
  const vStarWord = starWord(partialVWord, rank);
  const vcWord = complementWordForVStar(vStarWord, rank);
  const doubleString = makeLeftRichardsonDoubleString({
    vcWord,
    indexedWord: partialWord,
    plusPositions: partialPlusPositions,
  });
  return {
    t,
    indexedWord: partialWord,
    displayW: displayWordFromIndexedPrefix(indexedWord, t),
    vWord: partialVWord,
    vStarWord,
    vcWord,
    plusPositions: partialPlusPositions,
    doubleString,
  };
}

function pathStepLabel(step) {
  return `(${textWord(step.displayW)}, ${textWord(step.vWord)})`;
}

function buildPathData({ rank, indexedWord, vWord }) {
  if (indexedWord.length === 0) throw new Error("The word for w must be nonempty.");
  if (!isReducedTypeAWord(displayWordFromIndexedPrefix(indexedWord), rank)) {
    throw new Error("The displayed word s_{i_l}...s_{i_1} must be reduced.");
  }
  if (!isReducedTypeAWord(vWord, rank)) throw new Error("v must be entered as a reduced word.");
  const rightmost = rightmostRepresentativePositions({ vWord, indexedWord, rank });
  const plusPositions = rightmost.positions;
  const steps = Array.from({ length: indexedWord.length + 1 }, (_, t) => buildPartialRichardsonData({
    rank,
    indexedWord,
    plusPositions,
  }, t));
  const edges = indexedWord.map((generator, idx) => {
    const t = idx + 1;
    const caseType = plusPositions.includes(t) ? "case1" : "case2";
    return {
      t,
      generator,
      caseType,
      color: caseType === "case1" ? "blue" : "red",
      from: steps[t - 1],
      to: steps[t],
    };
  });
  const final = steps[steps.length - 1];
  return {
    rank,
    indexedWord,
    displayW: displayWordFromIndexedPrefix(indexedWord),
    inputVWord: vWord,
    rightmost,
    plusPositions,
    freePositions: indexedWord.map((_, idx) => idx + 1).filter((position) => !plusPositions.includes(position)),
    steps,
    edges,
    final,
  };
}

function renderFacts(data, t) {
  const partial = data.steps[t];
  const card = el("section", "card layered-facts-card");
  card.appendChild(el("h2", "", "Richardson Prefix Data"));

  function appendSection(title, rows) {
    const section = el("section", "layered-data-section");
    section.appendChild(el("h3", "", title));
    const grid = el("div", "ric-data-grid layered-data-grid");
    rows.forEach(([label, value]) => {
      const row = el("div", "ric-data-row");
      row.append(el("span", "ric-data-key", label), el("span", "formula ric-data-value", value));
      grid.appendChild(row);
    });
    section.appendChild(grid);
    card.appendChild(section);
  }

  appendSection("Input", [
    ["type", `A${subscriptNumber(data.rank)}`],
    ["β(w)", textWord(data.displayW)],
    ["v", textWord(data.inputVWord)],
  ]);

  appendSection("Representative", [
    ["P_Ric", `{${data.plusPositions.join(", ")}}`],
    ["M_Ric", `{${data.freePositions.join(", ")}}`],
  ]);

  appendSection("Current Prefix", [
    ["t", String(t)],
    ["β(wₜ)", textWord(partial.displayW)],
    ["vₜ", textWord(partial.vWord)],
    ["β(vₜᶜ)", textWord(partial.vcWord)],
  ]);

  const details = el("details", "layered-data-details");
  details.appendChild(el("summary", "", "Auxiliary data"));
  const detailGrid = el("div", "ric-data-grid layered-data-grid");
  [
    ["β(vₜ*)", textWord(partial.vStarWord)],
    ["(wₜ,vₜ)", pathStepLabel(partial)],
  ].forEach(([label, value]) => {
    const row = el("div", "ric-data-row");
    row.append(el("span", "ric-data-key", label), el("span", "formula ric-data-value", value));
    detailGrid.appendChild(row);
  });
  details.appendChild(detailGrid);
  card.appendChild(details);

  const note = el("p", "small-note");
  note.textContent = "P_Ric positions are length-additive (+); M_Ric positions create the trivalent vertices.";
  card.appendChild(note);
  return card;
}

function generateAllActions(rank) {
  const size = rank + 1;
  const out = [];
  function visit(prefix, remaining) {
    if (remaining.length === 0) {
      out.push(prefix.slice());
      return;
    }
    remaining.forEach((value, idx) => {
      prefix.push(value);
      visit(prefix, [...remaining.slice(0, idx), ...remaining.slice(idx + 1)]);
      prefix.pop();
    });
  }
  visit([], identityAction(size));
  return out;
}

function rightWeakInterval(data) {
  const fullAction = actionOfWord(data.displayW, data.rank);
  const fullLength = coxeterLengthOfAction(fullAction);
  const all = generateAllActions(data.rank);
  const nodes = all
    .map((action) => ({ action, key: actionKey(action), length: coxeterLengthOfAction(action) }))
    .filter((node) => {
      if (node.length > fullLength) return false;
      const quotient = multiplyActions(inverseAction(node.action), fullAction);
      return coxeterLengthOfAction(quotient) === fullLength - node.length;
    });
  const nodeMap = new Map(nodes.map((node) => [node.key, node]));
  const edges = [];
  nodes.forEach((node) => {
    for (let generator = 1; generator <= data.rank; generator += 1) {
      const nextAction = multiplyActions(node.action, simpleReflectionAction(generator, data.rank + 1));
      const nextKey = actionKey(nextAction);
      const next = nodeMap.get(nextKey);
      if (!next || next.length !== node.length + 1) continue;
      edges.push({ source: node.key, target: nextKey, generator });
    }
  });
  return { nodes, edges, nodeMap };
}

function renderWeakInterval(data, t, onSelectLayer) {
  const pathActions = data.steps.map((step) => actionOfWord(step.displayW, data.rank));
  const pathKeys = pathActions.map(actionKey);
  const pathEdgeByKey = new Map();
  data.edges.forEach((edge, idx) => {
    pathEdgeByKey.set(`${pathKeys[idx]}->${pathKeys[idx + 1]}`, edge);
  });
  const activeKey = pathKeys[t];
  const interval = data.rank <= 5 ? rightWeakInterval(data) : null;
  const pathOnly = !interval || interval.nodes.length > 96;
  const nodes = pathOnly
    ? pathActions.map((action, idx) => ({
      action,
      key: actionKey(action),
      length: idx,
      pathIndex: idx,
    }))
    : interval.nodes;
  const edges = pathOnly
    ? data.edges.map((edge, idx) => ({
      source: pathKeys[idx],
      target: pathKeys[idx + 1],
      generator: edge.generator,
    }))
    : interval.edges;
  const pathIndexByKey = new Map(pathKeys.map((key, idx) => [key, idx]));
  const rows = new Map();
  nodes.forEach((node) => {
    if (!rows.has(node.length)) rows.set(node.length, []);
    rows.get(node.length).push(node);
  });
  const sortedLengths = Array.from(rows.keys()).sort((a, b) => a - b);
  const rowGap = 84;
  const width = 920;
  const height = Math.max(220, 78 + (sortedLengths.length - 1) * rowGap);
  const positions = new Map();
  sortedLengths.forEach((length, rowIdx) => {
    const row = rows.get(length).sort((left, right) => {
      const leftPath = pathIndexByKey.has(left.key) ? pathIndexByKey.get(left.key) : 999;
      const rightPath = pathIndexByKey.has(right.key) ? pathIndexByKey.get(right.key) : 999;
      if (leftPath !== rightPath) return leftPath - rightPath;
      return left.key.localeCompare(right.key);
    });
    const y = 38 + rowIdx * rowGap;
    row.forEach((node, idx) => {
      const x = width / 2 + (idx - (row.length - 1) / 2) * Math.min(116, 760 / Math.max(row.length - 1, 1));
      positions.set(node.key, { x, y });
    });
  });

  const svg = svgEl("svg");
  svg.setAttribute("class", "layered-weak-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");

  edges.forEach((edge) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) return;
    const pathEdge = pathEdgeByKey.get(`${edge.source}->${edge.target}`);
    const line = svgEl("line");
    line.setAttribute("x1", String(source.x));
    line.setAttribute("y1", String(source.y + 16));
    line.setAttribute("x2", String(target.x));
    line.setAttribute("y2", String(target.y - 16));
    line.setAttribute("class", pathEdge ? `layered-weak-edge path-edge ${pathEdge.caseType}` : "layered-weak-edge");
    svg.appendChild(line);
    if (pathEdge) {
      const label = svgEl("text");
      label.setAttribute("x", String((source.x + target.x) / 2 + 8));
      label.setAttribute("y", String((source.y + target.y) / 2 - 5));
      label.setAttribute("class", `layered-edge-label ${pathEdge.caseType}`);
      label.textContent = `i=${edge.generator}`;
      svg.appendChild(label);
    }
  });

  nodes.forEach((node) => {
    const pos = positions.get(node.key);
    if (!pos) return;
    const pathIndex = pathIndexByKey.get(node.key);
    const group = svgEl("g");
    group.setAttribute("class", [
      "layered-weak-node-group",
      pathIndex !== undefined ? "on-path" : "",
      node.key === activeKey ? "active" : "",
    ].filter(Boolean).join(" "));
    if (pathIndex !== undefined) {
      group.style.cursor = "pointer";
      group.addEventListener("click", () => onSelectLayer(pathIndex));
    }
    const circle = svgEl("circle");
    circle.setAttribute("cx", String(pos.x));
    circle.setAttribute("cy", String(pos.y));
    circle.setAttribute("r", pathIndex !== undefined ? "18" : "13");
    circle.setAttribute("class", "layered-weak-node");
    const label = svgEl("text");
    label.setAttribute("x", String(pos.x));
    label.setAttribute("y", String(pos.y + 4));
    label.setAttribute("class", "layered-weak-label");
    label.textContent = pathIndex !== undefined
      ? textWord(data.steps[pathIndex].displayW)
      : textWord(reducedWordForAction(node.action));
    group.append(circle, label);
    svg.appendChild(group);
  });

  const wrap = el("div", "layered-weak-wrap");
  const head = el("div", "layered-panel-head");
  head.appendChild(el("h3", "", pathOnly ? "Prefix path" : "Prefix path in right weak order"));
  head.appendChild(el("span", "small-note", pathOnly ? "Interval hidden for size; path is shown." : "Path nodes are highlighted."));
  wrap.append(head, svg);
  return wrap;
}

function renderLayerStack(data, t, activeLayer, onSelectActiveLayer) {
  const wrap = el("div", "layered-stack-wrap");
  const head = el("div", "layered-panel-head");
  head.appendChild(el("h3", "", "Layers"));
  head.appendChild(el("span", "small-note", "Click a card to highlight its actual CGGLS move block."));
  wrap.appendChild(head);
  const strip = el("div", "layered-stack");
  data.edges.slice(0, t).reverse().forEach((edge) => {
    const card = el("button", `layer-card ${edge.caseType}${edge.t === activeLayer ? " active" : ""}`);
    card.type = "button";
    card.addEventListener("click", () => onSelectActiveLayer(edge.t));
    card.appendChild(el("span", "layer-card-kicker", `t=${edge.t}, i=${edge.generator}`));
    card.appendChild(el("strong", "", edge.caseType === "case1" ? "Case 1" : "Case 2"));
    card.appendChild(el("span", "", edge.caseType === "case1" ? "+ step, no local move" : "braid moves + trivalent"));
    card.appendChild(el("span", "layer-card-pair", `${pathStepLabel(edge.from)} → ${pathStepLabel(edge.to)}`));
    strip.appendChild(card);
  });
  const base = el("button", activeLayer === 0 ? "layer-card base active" : "layer-card base");
  base.type = "button";
  base.addEventListener("click", () => onSelectActiveLayer(0));
  base.appendChild(el("span", "layer-card-kicker", "base"));
  base.appendChild(el("strong", "", "(e,e)"));
  base.appendChild(el("span", "", "empty prefix"));
  strip.appendChild(base);
  wrap.appendChild(strip);
  return wrap;
}

function computeLayerStrips(data, t, bottomWeave, activeLayer = t) {
  const moves = bottomWeave.moves ?? [];
  const stepInfoByTriMove = new Map(
    (bottomWeave.stepInfos ?? [])
      .filter((info) => Number.isInteger(info.triMoveIndex))
      .map((info) => [info.triMoveIndex, info]),
  );
  const sourceStepByLayer = new Map(
    (bottomWeave.doubleString ?? [])
      .map((entry, idx) => ({ entry, sourceStep: idx + 1 }))
      .filter(({ entry }) => entry.block === "w" && Number.isInteger(entry.wPosition))
      .map(({ entry, sourceStep }) => [entry.wPosition, sourceStep]),
  );
  const moveIndicesBySourceStep = new Map();
  moves.forEach((move, moveIdx) => {
    if (!Number.isInteger(move.sourceStep)) return;
    if (!moveIndicesBySourceStep.has(move.sourceStep)) moveIndicesBySourceStep.set(move.sourceStep, []);
    moveIndicesBySourceStep.get(move.sourceStep).push(moveIdx);
  });
  function emptyAnchorForSourceStep(sourceStep) {
    if (!Number.isInteger(sourceStep)) return 0;
    const nextMoveIdx = moves.findIndex((move) => Number.isInteger(move.sourceStep) && move.sourceStep > sourceStep);
    return nextMoveIdx === -1 ? moves.length : nextMoveIdx;
  }
  const strips = [];

  for (let layer = t; layer >= 1; layer -= 1) {
    const edge = data.edges[layer - 1];
    const sourceStep = sourceStepByLayer.get(layer);
    const moveIndices = moveIndicesBySourceStep.get(sourceStep) ?? [];
    const startMove = moveIndices.length > 0 ? Math.min(...moveIndices) : emptyAnchorForSourceStep(sourceStep);
    const endMove = moveIndices.length > 0 ? Math.max(...moveIndices) + 1 : startMove;

    if (endMove <= startMove) {
      strips.push({
        layer,
        startMove,
        endMove,
        caseType: edge?.caseType ?? "",
        generator: edge?.generator ?? null,
        active: layer === activeLayer,
        clusterLabels: [],
        label: `t=${layer}${edge ? `, i=${edge.generator}` : ""}`,
        empty: true,
      });
      continue;
    }

    const clusterLabels = [];
    for (let moveIdx = startMove; moveIdx < endMove; moveIdx += 1) {
      const info = stepInfoByTriMove.get(moveIdx);
      if (info?.clusterVariable) clusterLabels.push(info.clusterVariable);
    }

    strips.push({
      layer,
      startMove,
      endMove,
      caseType: edge?.caseType ?? "",
      generator: edge?.generator ?? null,
      active: layer === activeLayer,
      clusterLabels,
      label: `t=${layer}${edge ? `, i=${edge.generator}` : ""}`,
    });
  }

  return strips;
}

function renderRecursiveWeaveCard(data, t, activeLayer) {
  const card = el("section", "card layered-main-weave-card");
  card.appendChild(htmlEl("h2", "", `𝒲<sub>Ric</sub><sup>L</sup>(t=${t})`));
  const subtitle = el("p", "card-subtitle");
  subtitle.textContent = "CGGLS left-inductive weave for the current prefix.";
  card.appendChild(subtitle);
  const trace = buildTrace(data, t, { diagnostic: false, activeLayer });
  card.appendChild(renderLayeredSeedPanels(trace));
  return card;
}

function renderLayeredSeedPanels(trace) {
  const cycleColors = new Map((trace.bottomWeave.lusztigCycles ?? []).map((cycle, idx) => [cycle.label, cycleColor(idx)]));
  const panels = el("div", "layered-seed-panels");
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

  const quiverPanel = renderQuiverAnswerPanel(trace.bottomWeave, cycleColors, selectCluster, null, {
    quiverLabel: trace.quiverLabel,
    matrixLabel: trace.matrixLabel,
  });
  const clusterPanel = renderClusterVariableAnswerPanel(trace, cycleColors, selectCluster, clearSelection, {
    weaveLabel: trace.weaveTitle,
    variableHeader: trace.variableHeader,
  });
  const edgePanel = el("div", "answer-panel layered-edge-variable-panel");
  const edgeHeader = el("div", "answer-panel-header");
  edgeHeader.appendChild(el("h3", "", "Weave"));
  edgeHeader.appendChild(el("div", "answer-panel-actions", "select an object"));
  edgePanel.appendChild(edgeHeader);
  const edgeNote = el("p", "small-note");
  edgeNote.textContent = "Bands mark the move block attached to each prefix step. Case 2 blocks contain one trivalent vertex.";
  edgePanel.appendChild(edgeNote);
  const edgeViewer = renderInteractiveWeaveViewer(trace, { cycleColors });
  edgeViewer.classList.add("main-interactive-weave", "layered-edge-variable-viewer");
  edgePanel.appendChild(edgeViewer);

  panels.append(edgePanel, quiverPanel, clusterPanel);
  syncSelection();
  return panels;
}

function renderCurrentDoubleString(data, t) {
  const partial = data.steps[t];
  const block = el("div", "layered-double-string");
  block.appendChild(htmlEl("h3", "", `Current double string s<sub>Ric</sub><sup>L</sup>(t=${t})`));
  const chips = el("div", "double-string-chips");
  partial.doubleString.forEach((entry) => {
    const chip = el("span", entry.source === "vc" ? "double-string-chip prefix" : "double-string-chip chain side-l");
    chip.textContent = `${entry.h}${entry.side}${entry.plus ? "+" : ""}`;
    chip.title = entry.source === "vc"
      ? `β(vₜᶜ), position ${entry.t}`
      : `i${subscriptNumber(entry.wPosition)}${entry.plus ? ", selected representative; + step with no trivalent vertex" : ", free trivalent layer"}`;
    chips.appendChild(chip);
  });
  block.appendChild(chips);
  return block;
}

function buildTrace(data, t, { diagnostic = true, activeLayer = t } = {}) {
  const partial = data.steps[t];
  const dynkin = createDynkinDatum({ family: "A", rank: data.rank });
  const firstPass = buildDoubleInductiveWeave(partial.doubleString, dynkin, { coordinatePrefix: "z" });
  const normalizedDoubleString = partial.doubleString.map((entry, idx) => ({
    ...entry,
    plus: firstPass.stepInfos[idx]?.plus ?? entry.plus,
  }));
  const bottomWeave = buildDoubleInductiveWeave(normalizedDoubleString, dynkin, { coordinatePrefix: "z" });
  const layerStrips = computeLayerStrips(data, t, bottomWeave, activeLayer);
  const topBoundaryWord = Array.isArray(bottomWeave.words?.[0])
    ? bottomWeave.words[0].slice()
    : normalizedDoubleString.map((entry) => entry.h);
  const topCoordinates = topBoundaryWord.map((_, idx) => `z${idx + 1}`);
  const weaveTitle = diagnostic ? `double-string diagnostic(t=${t})` : ricWeaveLabel(t);
  return {
    mode: "double-string",
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
    doubleStringTitle: ricStringLabel(t),
    junctionLabel: ricStringLabel(t),
    weaveTitle,
    weaveSubtitle: diagnostic
      ? `Old renderer applied to the current double string for ${pathStepLabel(partial)}.`
      : `Recursive top-stacked left Richardson weave for ${pathStepLabel(partial)}.`,
    quiverLabel: diagnostic ? `Q(diagnostic(t=${t}))` : `Q(${ricWeaveLabel(t)})`,
    matrixLabel: diagnostic ? `B(Q(diagnostic(t=${t})))` : `B(Q(${ricWeaveLabel(t)}))`,
    variableHeader: diagnostic ? `Aₜ = Aₜ(diagnostic(t=${t}))` : `Aₜ = Aₜ(${ricWeaveLabel(t)})`,
  };
}

function renderData(data, t, activeLayer = t) {
  const root = el("div", "layered-richardson-view");
  const top = el("div", "layered-top-grid");
  top.appendChild(renderFacts(data, t));
  const visualCard = el("section", "card layered-visual-card");
  visualCard.append(
    renderWeakInterval(data, t, setLayer),
    renderLayerStack(data, t, activeLayer, setActiveLayer),
    renderCurrentDoubleString(data, t),
  );
  top.appendChild(visualCard);
  root.appendChild(top);
  root.appendChild(renderRecursiveWeaveCard(data, t, activeLayer));
  output.replaceChildren(root);
}

function readDataInput() {
  const rank = parsePositiveInteger(rankInput.value, "rank");
  const indexedWord = parseTypeAWord(wInput.value, "word for w", rank);
  const vWord = parseTypeAWord(vInput.value, "v", rank);
  return buildPathData({ rank, indexedWord, vWord });
}

function setError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = "";
  errorBox.hidden = true;
}

function syncSlider(data, t) {
  layerInput.min = "0";
  layerInput.max = String(data.indexedWord.length);
  layerInput.value = String(t);
  layerOutput.value = `t=${t}`;
  layerOutput.textContent = `t=${t}`;
}

function runConstruction(requestedT = null) {
  try {
    clearError();
    const data = readDataInput();
    currentData = data;
    const current = requestedT === null ? data.indexedWord.length : requestedT;
    const t = Math.max(0, Math.min(data.indexedWord.length, Number.isFinite(current) ? current : data.indexedWord.length));
    currentT = t;
    currentActiveLayer = t;
    syncSlider(data, t);
    renderData(data, t, currentActiveLayer);
  } catch (error) {
    output.replaceChildren();
    currentData = null;
    currentT = 0;
    currentActiveLayer = 0;
    setError(error instanceof Error ? error.message : String(error));
  }
}

function setLayer(t) {
  if (!currentData) return runConstruction(t);
  const next = Math.max(0, Math.min(currentData.indexedWord.length, t));
  currentT = next;
  currentActiveLayer = next;
  syncSlider(currentData, next);
  renderData(currentData, next, currentActiveLayer);
}

function setActiveLayer(layer) {
  if (!currentData) return;
  currentActiveLayer = Math.max(0, Math.min(currentT, layer));
  renderData(currentData, currentT, currentActiveLayer);
}

function writeExample(example) {
  rankInput.value = example.rank;
  wInput.value = example.w;
  vInput.value = example.v;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runConstruction();
});

layerInput.addEventListener("input", () => {
  if (currentData) setLayer(Number(layerInput.value));
});

exampleA2Button.addEventListener("click", () => {
  writeExample(examples.a2);
  runConstruction();
});

exampleA3Button.addEventListener("click", () => {
  writeExample(examples.a3);
  runConstruction();
});

function initialLayerFromUrl(defaultLayer) {
  try {
    const value = Number.parseInt(new URLSearchParams(window.location.search).get("t") ?? "", 10);
    return Number.isInteger(value) ? value : defaultLayer;
  } catch {
    return defaultLayer;
  }
}

writeExample(examples.a3);
runConstruction(initialLayerFromUrl(examples.a3.w.split(/\s+/).filter(Boolean).length));
