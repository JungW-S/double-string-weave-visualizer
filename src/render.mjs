import {
  formatDoubleStringEntry,
  intervalTextForDisplay,
  makeAdmissibleChain,
} from "./core.mjs";
import {
  expandExpressionText,
} from "./weave.mjs";

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = text;
  return node;
}

function svgEl(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

function renderCard(title, body, subtitle = "") {
  const card = el("section", "card");
  const heading = el("h2");
  if (/[𝒲ζℭ_]/u.test(title)) heading.appendChild(formulaSpan(title));
  else heading.textContent = title;
  card.appendChild(heading);
  if (subtitle) {
    const subtitleNode = el("p", "card-subtitle");
    if (/[𝒲ζ_^]/u.test(subtitle)) subtitleNode.appendChild(formulaSpan(subtitle));
    else subtitleNode.textContent = subtitle;
    card.appendChild(subtitleNode);
  }
  card.appendChild(body);
  return card;
}

function markStepSection(node, steps) {
  node.classList.add("step-section");
  steps.forEach((step) => node.classList.add(`step-${step}`));
  return node;
}

function sequenceText(sequence) {
  return `(${sequence.join(", ")})`;
}

function formulaSpan(expr, className = "formula") {
  const node = el("span", className);
  const text = String(expr ?? "");
  const tokens = text.match(/[\p{L}\p{M}]+_\{[^}]+\}|[\p{L}\p{M}]+_[\p{L}\p{N}Δℭ]+|[\p{L}\p{M}]+[0-9]+|\^\{[^}]+\}|\^\*|\^\+|\^-?[\p{L}\p{N}]+|_\{[^}]+\}|_[\p{L}\p{N}Δℭ]+|\*|[()+\-\/^=,]|\s+|[0-9]+|./gu) ?? [];
  tokens.forEach((token) => {
    if (/^[\p{L}\p{M}]+_\{[^}]+\}$/u.test(token)) {
      const match = /^([\p{L}\p{M}]+)_\{([^}]+)\}$/u.exec(token);
      const variable = el("span", "formula-variable", match[1]);
      variable.appendChild(el("sub", "", match[2]));
      node.appendChild(variable);
      return;
    }
    if (/^[\p{L}\p{M}]+_[\p{L}\p{N}Δℭ]+$/u.test(token)) {
      const match = /^([\p{L}\p{M}]+)_([\p{L}\p{N}Δℭ]+)$/u.exec(token);
      const variable = el("span", "formula-variable", match[1]);
      variable.appendChild(el("sub", "", match[2]));
      node.appendChild(variable);
      return;
    }
    if (/^[\p{L}\p{M}]+[0-9]+$/u.test(token)) {
      const match = /^([\p{L}\p{M}]+)([0-9]+)$/u.exec(token);
      const variable = el("span", "formula-variable", match[1]);
      variable.appendChild(el("sub", "", match[2]));
      node.appendChild(variable);
      return;
    }
    if (/^\^-?[\p{L}\p{N}]+$/u.test(token)) {
      node.appendChild(el("sup", "", token.slice(1)));
      return;
    }
    if (/^\^\{[^}]+\}$/.test(token)) {
      node.appendChild(el("sup", "", token.slice(2, -1)));
      return;
    }
    if (token === "^*") {
      node.appendChild(el("sup", "", "*"));
      return;
    }
    if (token === "^+") {
      node.appendChild(el("sup", "", "+"));
      return;
    }
    if (/^_\{[^}]+\}$/.test(token)) {
      node.appendChild(el("sub", "", token.slice(2, -1)));
      return;
    }
    if (/^_[\p{L}\p{N}Δℭ]+$/u.test(token)) {
      node.appendChild(el("sub", "", token.slice(1)));
      return;
    }
    if (token === "*") {
      node.appendChild(el("span", "formula-operator", "·"));
      return;
    }
    if (token === "-") {
      node.appendChild(el("span", "formula-operator", "−"));
      return;
    }
    if (token === "+") {
      node.appendChild(el("span", "formula-operator", "+"));
      return;
    }
    if (token === "/") {
      node.appendChild(el("span", "formula-operator", "/"));
      return;
    }
    if (token === "=" || token === ",") {
      node.appendChild(el("span", "formula-operator", token));
      return;
    }
    if (/^\s+$/.test(token)) {
      node.appendChild(document.createTextNode(" "));
      return;
    }
    node.appendChild(document.createTextNode(token));
  });
  return node;
}

function mathText(text) {
  return formulaSpan(text, "math formula");
}

let quiverMarkerIdCounter = 0;

function clusterIndexText(label) {
  const match = /^A(\d+)$/.exec(String(label ?? ""));
  return match ? match[1] : String(label ?? "");
}

function clusterVariableText(label) {
  const match = /^A(\d+)$/.exec(String(label ?? ""));
  return match ? `A_${match[1]}` : String(label ?? "");
}

function appendSvgMath(node, text) {
  const tokens = String(text ?? "").match(/[\p{L}\p{M}]+[0-9]+|_\{[^}]+\}|\^\{[^}]+\}|_[\p{L}\p{N}Δℭ]+|\^[\p{L}\p{N}]+|./gu) ?? [];
  tokens.forEach((token) => {
    if (/^[\p{L}\p{M}]+[0-9]+$/u.test(token)) {
      const match = /^([\p{L}\p{M}]+)([0-9]+)$/u.exec(token);
      node.appendChild(document.createTextNode(match[1]));
      const sub = svgEl("tspan");
      sub.setAttribute("baseline-shift", "sub");
      sub.setAttribute("font-size", "70%");
      sub.textContent = match[2];
      node.appendChild(sub);
      return;
    }
    if (/^_\{[^}]+\}$/u.test(token) || /^_[\p{L}\p{N}Δℭ]+$/u.test(token)) {
      const sub = svgEl("tspan");
      sub.setAttribute("baseline-shift", "sub");
      sub.setAttribute("font-size", "70%");
      sub.textContent = token.startsWith("_{") ? token.slice(2, -1) : token.slice(1);
      node.appendChild(sub);
      return;
    }
    if (/^\^\{[^}]+\}$/u.test(token) || /^\^[\p{L}\p{N}]+$/u.test(token)) {
      const sup = svgEl("tspan");
      sup.setAttribute("baseline-shift", "super");
      sup.setAttribute("font-size", "70%");
      sup.textContent = token.startsWith("^{") ? token.slice(2, -1) : token.slice(1);
      node.appendChild(sup);
      return;
    }
    node.appendChild(document.createTextNode(token));
  });
}

function expressionSubstitutions(trace) {
  return Object.fromEntries((trace.bottomWeave.clusterValues ?? []).map((value) => [
    value.label,
    value.expression,
  ]));
}

function expandedExpression(trace, expr) {
  const text = String(expr ?? "");
  if (text === "") return "";
  try {
    return expandExpressionText(text, expressionSubstitutions(trace));
  } catch {
    return text;
  }
}

function topCoordinateExpression(trace, expr) {
  const withoutClusterLabels = expandedExpression(trace, expr);
  if (withoutClusterLabels === "") return "";
  try {
    return expandExpressionText(withoutClusterLabels, trace.topWeave.coordinateSubstitution ?? {});
  } catch {
    return withoutClusterLabels;
  }
}

function renderValueBlock(label, node) {
  const item = el("div", "variable-value-block");
  const labelNode = el("span", "summary-label");
  if (/[_{}^𝒲ζ̃]/u.test(String(label))) {
    labelNode.appendChild(formulaSpan(label, "formula summary-label-formula"));
  } else {
    labelNode.textContent = label;
  }
  item.appendChild(labelNode);
  item.appendChild(node);
  return item;
}

function renderChainRibbon(trace, {
  showTitle = true,
  onBoxMove = null,
  titleText = "ℭ = (𝔠_1,...,𝔠_r)",
  metaText = `c=${trace.c}, LR=(${trace.lr.join(", ")})`,
  entryMeta = null,
} = {}) {
  const block = el("div", "chain-ribbon-block");
  if (showTitle) {
    const title = el("div", "chain-ribbon-title");
    title.appendChild(formulaSpan(titleText, "math formula"));
    title.appendChild(el("span", "chain-ribbon-meta", metaText));
    block.appendChild(title);
  }

  const ribbon = el("div", "chain-ribbon");
  const movesByK = new Map(
    typeof onBoxMove === "function"
      ? movableBoxMoves(trace).map((move) => [move.k, move])
      : [],
  );
  function makeMoveButton(move) {
    const action = el("button", "chain-box-move-action");
    action.type = "button";
    action.appendChild(el("span", "chain-box-move-text", `B${move.k}`));
    action.appendChild(el("span", "chain-box-move-tooltip", boxMoveTooltipText(move)));
    action.setAttribute("aria-label", `Apply box move B_${move.k}`);
    action.addEventListener("mouseenter", () => setBoxMoveHighlight(ribbon.closest(".admissible-chain-panel"), move, true));
    action.addEventListener("mouseleave", () => setBoxMoveHighlight(ribbon.closest(".admissible-chain-panel"), move, false));
    action.addEventListener("focus", () => setBoxMoveHighlight(ribbon.closest(".admissible-chain-panel"), move, true));
    action.addEventListener("blur", () => setBoxMoveHighlight(ribbon.closest(".admissible-chain-panel"), move, false));
    action.addEventListener("click", (event) => {
      event.stopPropagation();
      onBoxMove({
        k: move.k,
        lr: move.nextLR.slice(),
        operation: move.sameColor ? "mutation" : "swap",
      });
    });
    return action;
  }
  trace.chain.rows.forEach((row) => {
    const chip = el("div", row.frozen ? "chain-chip frozen chain-selectable" : "chain-chip chain-selectable");
    chip.dataset.chainT = String(row.t);
    chip.setAttribute("role", "button");
    chip.setAttribute("tabindex", "0");
    chip.appendChild(formulaSpan(`𝔠_${row.t}`, "chain-chip-title formula"));
    chip.appendChild(el("span", "chain-chip-interval", intervalTextForDisplay(row.box)));
    if (typeof entryMeta === "function") {
      chip.appendChild(el("span", "chain-chip-color", entryMeta(row)));
    }
    chip.title = `envelope ${intervalTextForDisplay(row.envelope)}, effective end z_${row.t}=${row.effectiveEnd}${row.frozen ? ", frozen" : ""}`;
    ribbon.appendChild(chip);
  });
  block.appendChild(ribbon);
  if (movesByK.size > 0) {
    const moveStrip = el("div", "chain-box-move-strip");
    moveStrip.appendChild(el("span", "chain-box-move-label", "Box moves"));
    const moveActions = el("div", "chain-box-move-actions");
    Array.from(movesByK.values()).forEach((move) => {
      moveActions.appendChild(makeMoveButton(move));
    });
    moveStrip.appendChild(moveActions);
    block.appendChild(moveStrip);
  }
  return block;
}

function boxMoveTooltipText(move) {
  const operation = move.sameColor ? `mu_${move.k}` : `sigma_${move.k},${move.k + 1}`;
  const changed = move.hIndices.map((idx) => `H_${idx}`).join(", ");
  const reason = move.sameColor ? "same color" : "different colors";
  return `${operation}: ${reason}; changes ${changed}`;
}

function lrSideClass(move) {
  return move === "L" ? "side-l" : "side-r";
}

function renderChainDataGrid(trace) {
  const grid = el("div", "chain-data-grid");
  grid.style.setProperty("--chain-data-cols", String(trace.chain.rows.length));

  const colorValues = el("div", "chain-data-values");
  trace.chain.rows.forEach((row) => {
    const cell = el("span", "chain-data-cell color-cell", String(row.color));
    cell.title = `𝔠_${row.t}: bcol(𝔠_${row.t})=${row.color}`;
    colorValues.appendChild(cell);
  });

  const lrValues = el("div", "chain-data-values");
  trace.chain.rows.forEach((row) => {
    if (row.t === 1) {
      const cell = el("span", "chain-data-cell empty-cell", "");
      cell.title = "LR sequence starts after 𝔠_1.";
      lrValues.appendChild(cell);
      return;
    }
    const move = trace.lr[row.t - 2];
    const cell = el("span", `chain-data-cell lr-cell ${lrSideClass(move)}`, move);
    cell.dataset.lrIndex = String(row.t - 1);
    cell.title = `𝓗_${row.t - 1}=${move}`;
    lrValues.appendChild(cell);
  });

  grid.appendChild(formulaSpan("bcol(𝔠_t)", "formula chain-data-row-label"));
  grid.appendChild(colorValues);
  grid.appendChild(el("span", "chain-data-row-label", "LR sequence"));
  grid.appendChild(lrValues);
  return grid;
}

function renderChainDataDetails(trace) {
  const details = el("details", "chain-data-details");
  const summary = el("summary", "chain-data-summary");
  summary.appendChild(formulaSpan("ℭ", "formula"));
  details.appendChild(summary);
  details.appendChild(renderChainDataGrid(trace));
  return details;
}

function renderSignedWordDetails(trace) {
  const details = el("details", "signed-word-details");
  const summary = el("summary", "signed-word-summary");
  summary.appendChild(el("span", "", "Associated signed word"));
  summary.appendChild(formulaSpan("h̲(ℭ)", "formula"));
  details.appendChild(summary);
  const chips = el("div", "signed-word-chips");
  trace.chain.rows.forEach((row) => {
    const positive = row.t === 1 || trace.lr[row.t - 2] === "L";
    const chip = el("span", positive ? "signed-word-chip positive" : "signed-word-chip negative");
    chip.appendChild(el("span", "signed-word-sign", positive ? "+" : "-"));
    chip.appendChild(el("span", "signed-word-color", String(row.color)));
    chip.title = `ε_${row.t}=${positive ? "+1" : "-1"}, h_${row.t}=bcol(𝔠_${row.t})=${row.color}`;
    chips.appendChild(chip);
  });
  details.appendChild(chips);
  return details;
}

function flipLRMove(move) {
  return move === "L" ? "R" : "L";
}

function boxMoveLR(lr, k) {
  const next = lr.slice();
  if (k === 1) {
    next[0] = flipLRMove(next[0]);
  } else {
    next[k - 2] = flipLRMove(next[k - 2]);
    next[k - 1] = flipLRMove(next[k - 1]);
  }
  return next;
}

function boxMoveHIndices(k) {
  return k === 1 ? [1] : [k - 1, k];
}

function previewChainRows(trace, nextLR) {
  try {
    const nextC = nextLR.filter((move) => move === "L").length + 1;
    return makeAdmissibleChain({
      datum: trace.dynkin,
      u: trace.u,
      c: nextC,
      lr: nextLR,
    }).rows;
  } catch {
    return [];
  }
}

function boxMoveRowIndices(k) {
  return k === 1 ? [1] : [k, k + 1];
}

function localBoxRows(rows, k) {
  return boxMoveRowIndices(k)
    .map((t) => rows[t - 1])
    .filter(Boolean)
    .map((row) => ({
      t: row.t,
      envelope: row.envelope.slice(),
      box: row.box.slice(),
      effectiveEnd: row.effectiveEnd,
    }));
}

function movableBoxMoves(trace) {
  const rows = trace.chain.rows;
  const moves = [];
  for (let k = 1; k < rows.length; k += 1) {
    const movable = k === 1 || trace.lr[k - 2] !== trace.lr[k - 1];
    if (!movable) continue;
    const sameColor = rows[k - 1].color === rows[k].color;
    const nextLR = boxMoveLR(trace.lr, k);
    const previewRows = previewChainRows(trace, nextLR);
    moves.push({
      k,
      sameColor,
      nextLR,
      hIndices: boxMoveHIndices(k),
      leftColor: rows[k - 1].color,
      rightColor: rows[k].color,
      currentRows: localBoxRows(rows, k),
      resultRows: localBoxRows(previewRows, k),
    });
  }
  return moves;
}

function clearBoxMovePreview(line) {
  line?.classList.remove("box-move-preview-row");
  line?.querySelectorAll(".timeline-cell").forEach((cell) => {
    cell.classList.remove(
      "box-move-removed-envelope",
      "box-move-added-envelope",
    );
  });
}

function intervalContains(interval, pos) {
  return interval && interval[0] <= pos && pos <= interval[1];
}

function markTimelineBoxDifference(container, currentRow, resultRow) {
  const t = currentRow?.t ?? resultRow?.t;
  if (!t) return;
  const line = container.querySelector(`.timeline-row[data-timeline-t="${t}"]`);
  if (!line) return;
  const currentEnvelope = currentRow?.envelope ?? null;
  const resultEnvelope = resultRow?.envelope ?? null;
  let hasChange = false;
  line.querySelectorAll(".timeline-cell").forEach((cell) => {
    const pos = Number(cell.dataset.timelinePos);
    const wasInEnvelope = intervalContains(currentEnvelope, pos);
    const willBeInEnvelope = intervalContains(resultEnvelope, pos);
    if (wasInEnvelope && !willBeInEnvelope) {
      cell.classList.add("box-move-removed-envelope");
      hasChange = true;
    }
    if (!wasInEnvelope && willBeInEnvelope) {
      cell.classList.add("box-move-added-envelope");
      hasChange = true;
    }
  });
  if (hasChange) line.classList.add("box-move-preview-row");
}

function rowMapByT(rows) {
  return new Map((rows ?? []).map((row) => [row.t, row]));
}

function boxMovePreviewRows(move) {
  const current = rowMapByT(move.currentRows);
  const result = rowMapByT(move.resultRows);
  return Array.from(new Set([...current.keys(), ...result.keys()]))
    .sort((a, b) => a - b)
    .map((t) => ({
      t,
      current: current.get(t) ?? null,
      result: result.get(t) ?? null,
    }));
}

function clearBoxMovePreviewRows(container, move) {
  boxMovePreviewRows(move).forEach(({ t }) => {
    clearBoxMovePreview(container.querySelector(`.timeline-row[data-timeline-t="${t}"]`));
  });
}

function markBoxMovePreviewRows(container, move) {
  boxMovePreviewRows(move).forEach(({ current, result }) => {
    markTimelineBoxDifference(container, current, result);
  });
}

function setBoxMoveHighlight(container, move, active) {
  if (!container) return;
  move.hIndices.forEach((idx) => {
    const cell = container.querySelector(`.lr-cell[data-lr-index="${idx}"]`);
    if (cell) cell.classList.toggle("box-move-highlight", active);
  });
  clearBoxMovePreviewRows(container, move);
  if (!active) return;
  markBoxMovePreviewRows(container, move);
}

function intervalTextOrEmpty(interval) {
  return interval === null ? "∅" : intervalTextForDisplay(interval);
}

function moduleClassLabel(interval) {
  return `[M^{𝒊}${intervalTextOrEmpty(interval)}]`;
}

function iBoxElementLabel(interval) {
  return `A(${intervalTextOrEmpty(interval)})`;
}

function cuspidalClassExpression(expr) {
  return String(expr ?? "");
}

function renderDeterminantialModules(trace, cycleColors) {
  const usesIBoxElements = trace.forceIBoxElements === true || trace.family === "B" || trace.family === "C";
  const panel = el("div", "answer-panel determinantial-section");
  const header = el("div", "answer-panel-header");
  header.appendChild(el("h3", "", usesIBoxElements ? "i-box elements" : "Affine Determinantial Modules"));
  const headerRight = el("div", "answer-panel-actions");
  headerRight.appendChild(mathText(usesIBoxElements ? "D_t = A(𝔠_t)" : "M_t = [M^{𝒊}(𝔠_t)]"));
  header.appendChild(headerRight);
  panel.appendChild(header);

  const note = el("p", "small-note");
  note.appendChild(formulaSpan("C_t"));
  if (usesIBoxElements) {
    note.append(` abbreviates the singleton i-box element; non-singleton i-box elements are computed by the finite type ${trace.family} T-system.`);
  } else {
    note.append(" abbreviates ");
    note.appendChild(formulaSpan("[C^{𝒊}_t]"));
    note.append(".");
  }
  panel.appendChild(note);

  const list = el("div", "cluster-answer-list determinantial-list");
  trace.determinantialModules.rows.forEach((row) => {
    const clusterLabel = `A${row.t}`;
    const item = el("div", "cluster-answer-item determinantial-row chain-selectable");
    item.dataset.chainT = String(row.t);
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    if (row.calculation?.interval && trace.chain.rows[row.t - 1]?.frozen) item.classList.add("frozen");
    item.style.setProperty("--cycle-color", cycleColors.get(clusterLabel) ?? "var(--accent)");
    const label = el("span", "cluster-answer-label determinantial-answer-label");
    label.appendChild(formulaSpan(`${usesIBoxElements ? "D" : "M"}_${row.t}`, "formula"));
    label.title = usesIBoxElements ? iBoxElementLabel(row.interval) : moduleClassLabel(row.interval);
    item.appendChild(label);
    const content = el("div", "cluster-answer-content");
    content.appendChild(formulaSpan(cuspidalClassExpression(row.expression), "cluster-answer-expression formula determinantial-expression"));
    item.appendChild(content);
    list.appendChild(item);
  });
  panel.appendChild(list);
  return panel;
}

function renderLegend(items, className = "legend") {
  const legend = el("div", className);
  items.forEach(([boxClass, label]) => {
    const item = el("span", "legend-item");
    item.appendChild(el("span", boxClass));
    item.appendChild(el("span", "", label));
    legend.appendChild(item);
  });
  return legend;
}

function renderAdmissibleChainPanel(trace, pyramidBlock, chainBlock) {
  const panel = el("div", "answer-panel admissible-chain-panel");
  const header = el("div", "answer-panel-header");
  header.appendChild(el("h3", "", "Admissible Chain"));
  panel.appendChild(header);

  const note = el("p", "small-note chain-panel-note");
  note.appendChild(formulaSpan(`c=${trace.c}`));
  note.append(", ");
  note.appendChild(formulaSpan(`LR=(${trace.lr.join(", ")})`));
  note.append(". The LR sequence determines the envelopes and the i-boxes of ");
  note.appendChild(formulaSpan("ℭ"));
  note.append(".");
  panel.appendChild(note);

  const body = el("div", "admissible-chain-body");
  body.append(pyramidBlock, chainBlock);
  panel.appendChild(body);
  return panel;
}

function renderTimeline(trace, cycleColors, options = {}) {
  const wrap = el("div", "timeline");
  wrap.style.setProperty("--timeline-cols", String(trace.u.length));
  const header = el("div", "timeline-row timeline-header");
  header.appendChild(el("div", "timeline-label", ""));
  for (let pos = 1; pos <= trace.u.length; pos += 1) {
    const cell = el("div", "timeline-cell header-cell", String(pos));
    cell.title = `position ${pos}, color ${trace.u[pos - 1]}`;
    header.appendChild(cell);
  }
  wrap.appendChild(header);

  trace.chain.rows.forEach((row) => {
    const line = el("div", "timeline-row chain-selectable");
    line.dataset.chainT = String(row.t);
    line.dataset.timelineT = String(row.t);
    line.setAttribute("role", "button");
    line.setAttribute("tabindex", "0");
    line.appendChild(el("div", "timeline-label", `t=${row.t}`));
    for (let pos = 1; pos <= trace.u.length; pos += 1) {
      const classes = ["timeline-cell"];
      if (row.envelope[0] <= pos && pos <= row.envelope[1]) classes.push("in-envelope");
      if (row.box[0] <= pos && pos <= row.box[1]) classes.push("in-box");
      if (pos === row.effectiveEnd) classes.push("effective");
      const cell = el("div", classes.join(" "), String(trace.u[pos - 1]));
      cell.dataset.timelinePos = String(pos);
      cell.title = `position ${pos}`;
      line.appendChild(cell);
    }
    wrap.appendChild(line);
  });

  const legend = renderLegend([
    ["legend-box envelope", "envelope"],
    ["legend-box ibox", "i-box"],
    ["legend-box effective", "effective end zₜ"],
  ]);

  const pyramidBlock = el("div", "chain-section");
  pyramidBlock.appendChild(el("span", "chain-section-title", "Envelopes"));
  pyramidBlock.append(wrap, legend);

  const chainBlock = el("div", "chain-section");
  const chainHeader = el("div", "chain-section-header");
  chainHeader.appendChild(el("span", "chain-section-title", "i-boxes in ℭ"));
  chainHeader.appendChild(renderLegend([["legend-box frozen", "frozen"]], "legend compact-legend"));
  chainBlock.appendChild(chainHeader);
  chainBlock.appendChild(renderChainRibbon(trace, { showTitle: false, onBoxMove: options.onBoxMove }));
  chainBlock.appendChild(renderSignedWordDetails(trace));

  const body = el("div", "chain-visual-block");
  let selectedChainT = null;
  function clusterLabelForT(t) {
    return `A${t}`;
  }
  function syncChainSelection() {
    body.classList.toggle("has-chain-selection", selectedChainT !== null);
    body.querySelectorAll("[data-chain-t]").forEach((node) => {
      node.classList.toggle("active", selectedChainT !== null && Number(node.dataset.chainT) === selectedChainT);
    });
    body.querySelectorAll("[data-cluster]").forEach((node) => {
      node.classList.toggle("active", selectedChainT !== null && node.dataset.cluster === clusterLabelForT(selectedChainT));
    });
    body.querySelectorAll(".quiver-arrow").forEach((node) => {
      const selectedLabel = selectedChainT === null ? null : clusterLabelForT(selectedChainT);
      const incident = selectedLabel !== null
        && (node.dataset.source === selectedLabel || node.dataset.target === selectedLabel);
      node.classList.toggle("active", incident);
      node.classList.toggle("dimmed", selectedLabel !== null && !incident);
    });
  }
  function selectChainT(t) {
    selectedChainT = selectedChainT === t ? null : t;
    syncChainSelection();
  }
  body.addEventListener("click", (event) => {
    const target = event.target.closest("[data-chain-t]");
    if (!target || !body.contains(target)) return;
    selectChainT(Number(target.dataset.chainT));
  });
  body.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target.closest("[data-chain-t]");
    if (!target || !body.contains(target)) return;
    event.preventDefault();
    selectChainT(Number(target.dataset.chainT));
  });

  body.appendChild(renderAdmissibleChainPanel(trace, pyramidBlock, chainBlock));
  const chainQuiver = renderChainQuiver(trace, cycleColors, (label) => selectChainT(Number(clusterIndexText(label))));
  if (chainQuiver) body.appendChild(chainQuiver);
  body.appendChild(renderDeterminantialModules(trace, cycleColors));
  syncChainSelection();
  return renderCard(
    "ℭ",
    body,
  );
}

function oppositeQuiverData(quiver) {
  if (!quiver) return null;
  const labels = quiver.labels ?? [];
  const epsilon = quiver.epsilon
    ? Object.fromEntries(labels.map((row) => [
      row,
      Object.fromEntries(labels.map((col) => [col, negateQuiverWeight(quiver.epsilon[row]?.[col] ?? 0)])),
    ]))
    : quiver.epsilon;
  return {
    ...quiver,
    epsilon,
    arrows: (quiver.arrows ?? []).map((arrow) => ({
      ...arrow,
      source: arrow.target,
      target: arrow.source,
    })),
  };
}

function renderChainQuiver(trace, cycleColors, onSelect = null) {
  const quiver = trace.chain.exchangeMatrix ?? oppositeQuiverData(trace.bottomWeave.quiverData);
  if (!quiver || (quiver.labels ?? []).length === 0) return null;
  const ordinary = quiver.ordinaryQuiver !== false;

  const section = el("div", "answer-panel quiver-answer-panel chain-quiver-section");
  const header = el("div", "answer-panel-header");
  header.appendChild(el("h3", "", ordinary ? "Quiver" : "Valued exchange graph"));
  const headerRight = el("div", "answer-panel-actions");
  headerRight.appendChild(mathText(ordinary ? "Q(ℭ)" : "B_C(ℭ)"));
  header.appendChild(headerRight);
  section.appendChild(header);

  const scroller = el("div", "quiver-scroll chain-quiver-scroll");
  scroller.appendChild(renderQuiverSvg(quiver, cycleColors, onSelect));
  section.appendChild(scroller);
  section.appendChild(renderExchangeMatrixToggle(quiver, ordinary ? "B(Q(ℭ))" : "B_C(ℭ)", {
    initiallyOpen: !ordinary,
  }));
  const exchangeDefinition = renderAdmissibleChainExchangeDefinition(quiver);
  if (exchangeDefinition) section.appendChild(exchangeDefinition);
  section.classList.toggle("matrix-open", !ordinary);
  return section;
}

function renderAdmissibleChainExchangeDefinition(quiver) {
  if (quiver.source !== "KK24 admissible-chain exchange matrix") return null;
  const ordinary = quiver.ordinaryQuiver !== false;
  const details = el("details", "exchange-definition-details");
  details.open = !ordinary;
  const summary = el("summary", "exchange-definition-summary", "KK24 exchange matrix convention");
  details.appendChild(summary);
  const body = el("div", "exchange-definition-body");

  const intro = el("p");
  intro.append("For a finite type admissible chain, the basic exchange datum is ");
  intro.appendChild(formulaSpan("B̃(F)=(b_{c,c′})_{c∈F,c′∈F^ex}"));
  intro.append(". Rows are all i-boxes in ");
  intro.appendChild(formulaSpan("F"));
  intro.append("; columns are the exchangeable boxes ");
  intro.appendChild(formulaSpan("F^ex=F∖F^fr"));
  intro.append(".");
  body.appendChild(intro);

  const skew = el("p");
  skew.append("For ");
  skew.appendChild(formulaSpan("c=[x,y]"));
  skew.append(", ");
  skew.appendChild(formulaSpan("d_c=d_{i_c}"));
  skew.append(", and the mutable part satisfies ");
  skew.appendChild(formulaSpan("d_c b_{c,c′}=-d_{c′} b_{c′,c}"));
  skew.append(". Thus in non-simply-laced type the picture is a valued graph shorthand, not an ordinary quiver.");
  body.appendChild(skew);

  const rules = el("div", "exchange-definition-rules");
  rules.appendChild(el("div", "exchange-definition-rule-title", "Positive entries"));
  [
    "b_{[x,y],[x′,y′]}=1 if (x=x′ and y′=y_-) or (y=y′ and x′=x_-).",
    "If c_{i_x,i_{x′}}<0, then b_{[x,y],[x′,y′]}=-c_{i_x,i_{x′}} in the four KK24 effective-end cases.",
    "(a) [x,y^+]∈F, x is the effective end of [x,y], x′_-<x<x′, and y′<y^+<y′^+.",
    "(b) [x,y^+]∈F, y′ is the effective end of [x′,y′], x′_-<x, and y<y′<y^+<y′^+.",
    "(c) [x′_-,y′]∈F, y′ is the effective end of [x′,y′], x_-<x′_-<x, and y<y′<y^+.",
    "(d) [x′_-,y′]∈F, x is the effective end of [x,y], x_-<x′_-<x<x′, and y′<y^+.",
    "All other positive entries are zero; negative entries are determined by skew-symmetrizability.",
  ].forEach((text) => {
    const line = el("div", "exchange-definition-rule");
    line.appendChild(formulaSpan(text));
    rules.appendChild(line);
  });
  body.appendChild(rules);

  const allRight = el("div", "exchange-definition-rules");
  allRight.appendChild(el("div", "exchange-definition-rule-title", "All-right chain"));
  [
    "b_{s,t}=1 if s=t^+.",
    "b_{s,t}=-1 if t=s^+.",
    "b_{s,t}=-c_{i_s,i_t} if s<t<s^+<t^+ and c_{i_s,i_t}<0.",
    "b_{s,t}=c_{i_s,i_t} if t<s<t^+<s^+ and c_{i_s,i_t}<0.",
    "b_{s,t}=0 otherwise; last occurrences are frozen.",
  ].forEach((text) => {
    const line = el("div", "exchange-definition-rule");
    line.appendChild(formulaSpan(text));
    allRight.appendChild(line);
  });
  body.appendChild(allRight);

  const weights = el("p");
  weights.append("The table displays matrix entries. KK24's weighted drawing uses horizontal weight ");
  weights.appendChild(formulaSpan("d_{i_x}"));
  weights.append(" and vertical weight ");
  weights.appendChild(formulaSpan("-d_{i_x}c_{i_x,i_{x′}}"));
  weights.append(".");
  body.appendChild(weights);

  details.appendChild(body);
  return details;
}

function renderDoubleString(trace) {
  const rxwText = "Δ̲";
  const body = el("div", "double-string-block");
  const stringPanel = el("div", "string-construction-panel");
  const stringHeader = el("div", "string-panel-header");
  stringHeader.appendChild(el("span", "string-panel-title", "Double string"));
  stringPanel.appendChild(stringHeader);
  const shortNote = el("p", "double-string-rule-note");
  shortNote.append("Associated with ");
  shortNote.appendChild(formulaSpan("ℭ", "formula"));
  shortNote.append(" and the reduced expression ");
  shortNote.appendChild(formulaSpan(rxwText, "formula"));
  shortNote.append(".");
  stringPanel.appendChild(shortNote);

  stringPanel.appendChild(renderChainDataDetails(trace));
  const expression = el("div", "double-string-expression");
  expression.appendChild(formulaSpan(`s_{${rxwText}}(ℭ) = `));
  const chips = el("div", "double-string-chips");
  trace.doubleString.forEach((entry) => {
    const chip = el(
      "span",
      entry.source === "rxw"
        ? "double-string-chip prefix"
        : `double-string-chip chain ${lrSideClass(entry.side)}`,
    );
    chip.textContent = formatDoubleStringEntry(entry);
    chip.title = entry.source === "rxw"
      ? `from ${rxwText}, position ${entry.t}`
      : `from i-box step t=${entry.t}`;
    chips.appendChild(chip);
  });
  expression.appendChild(chips);
  stringPanel.appendChild(expression);
  body.appendChild(stringPanel);

  const preview = el("div", "string-weave-preview");
  const previewHeader = el("div", "string-panel-header");
  previewHeader.appendChild(formulaSpan(`𝒲^B_{${rxwText}}(ℭ)`, "formula string-panel-title"));
  previewHeader.appendChild(formulaSpan(`double inductive weave associated with s_{${rxwText}}(ℭ)`, "formula string-panel-subtitle"));
  preview.appendChild(previewHeader);
  const topBoundaryGroups = [
    {
      label: "L entries, read in reverse",
      entries: trace.doubleSummary.chainEntries.filter((entry) => entry.side === "L").reverse(),
      kind: "chain",
    },
    {
      label: rxwText,
      entries: trace.doubleSummary.prefix,
      kind: "prefix",
    },
    {
      label: "R entries, read in order",
      entries: trace.doubleSummary.chainEntries.filter((entry) => entry.side === "R"),
      kind: "chain",
    },
  ];
  const previewToolbar = el("div", "full-weave-toolbar string-weave-toolbar");
  const sizeControls = el("div", "full-weave-control-group");
  const previewScroll = el("div", "weave-scroll string-weave-scroll");
  const fitSvg = renderBottomWeaveSvg(trace.bottomWeave, true, {
    showInitialTopLabels: false,
    showBoundaryWordLabels: false,
    topBoundarySummary: {
      boundary: `i_{${rxwText}}(ℭ) =`,
      groups: topBoundaryGroups,
    },
  });
  const fullSvg = renderBottomWeaveSvg(trace.bottomWeave, false, {
    showInitialTopLabels: false,
    showBoundaryWordLabels: false,
    topBoundarySummary: {
      boundary: `i_{${rxwText}}(ℭ) =`,
      groups: topBoundaryGroups,
    },
  });
  fullSvg.classList.add("hidden");
  previewScroll.append(fitSvg, fullSvg);
  [
    ["fit", "Fit"],
    ["full", "Full"],
  ].forEach(([mode, label], idx) => {
    const button = el("button", idx === 0 ? "weave-size-button active" : "weave-size-button", label);
    button.type = "button";
    button.addEventListener("click", () => {
      const compactMode = mode === "fit";
      fitSvg.classList.toggle("hidden", !compactMode);
      fullSvg.classList.toggle("hidden", compactMode);
      previewScroll.classList.toggle("full-mode", !compactMode);
      sizeControls.querySelectorAll(".weave-size-button").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
    });
    sizeControls.appendChild(button);
  });
  previewToolbar.appendChild(sizeControls);
  preview.append(previewToolbar, previewScroll);
  body.appendChild(preview);

  return renderCard(
    `s_{${rxwText}}(ℭ)`,
    body,
  );
}

function generatorColor(generator) {
  const palette = [
    "#1f5fbf",
    "#b5292f",
    "#17834d",
    "#7d4bb3",
    "#c27616",
    "#0c766f",
    "#c2185b",
    "#4f5b66",
  ];
  return palette[(generator - 1) % palette.length];
}

export function cycleColor(index) {
  const palette = [
    "#6d6bff",
    "#ef4d75",
    "#009b8e",
    "#f59e0b",
    "#22a7f0",
    "#a855f7",
    "#84cc16",
    "#f97316",
  ];
  return palette[index % palette.length];
}

function rowXPositions(length, center, spacing) {
  if (length === 0) return [];
  return Array.from({ length }, (_, idx) => center + (idx - (length - 1) / 2) * spacing);
}

function pathD(x1, y1, x2, y2) {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

function appendPath(svg, d, color, className = "weave-strand") {
  const path = svgEl("path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", color);
  path.setAttribute("class", className);
  svg.appendChild(path);
  return path;
}

function appendCycleOverlay(svg, d, cycle, color) {
  const path = svgEl("path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", color);
  path.setAttribute("class", "cycle-overlay hidden");
  path.dataset.cycle = cycle.label;
  svg.appendChild(path);
}

function insetHorizontalSegment(x1, x2, startGap = 0, endGap = 0) {
  const direction = x2 >= x1 ? 1 : -1;
  const length = Math.abs(x2 - x1);
  if (length <= startGap + endGap + 1) return [x1, x2];
  return [x1 + direction * startGap, x2 - direction * endGap];
}

function appendText(svg, x, y, text, className = "weave-label") {
  const node = svgEl("text");
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
  node.setAttribute("class", className);
  appendSvgMath(node, text);
  svg.appendChild(node);
  return node;
}

function appendWeaveVertexBadge(svg, x, y, label, className = "weave-cluster-badge") {
  const text = clusterIndexText(label);
  const width = Math.max(16, 10 + text.length * 6);
  const group = svgEl("g");
  group.setAttribute("class", className);
  const box = svgEl("rect");
  box.setAttribute("x", String(x - width / 2));
  box.setAttribute("y", String(y - 8));
  box.setAttribute("width", String(width));
  box.setAttribute("height", "16");
  box.setAttribute("rx", "8");
  const node = svgEl("text");
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y + 4));
  node.textContent = text;
  group.append(box, node);
  svg.appendChild(group);
  return group;
}

function triInfoForStrip(weave, stripIdx) {
  return weave.stepInfos.find((info) => info.triMoveIndex === stripIdx) ?? null;
}

function drawStripGeometry(svg, {
  before,
  after,
  move,
  triInfo = null,
  width,
  topY,
  botY,
  center,
  spacing,
  showBoundaryLabels = true,
  showVirtualLabels = false,
  showEdgeNumbers = false,
  showDashedRay = false,
  cycleContext = null,
}) {
  const topX = rowXPositions(before.length, center, spacing);
  const botX = rowXPositions(after.length, center, spacing);
  const p = move.pos;

  function supportedCycles(topIdx = null, botIdx = null) {
    if (!cycleContext) return [];
    return cycleContext.cycles.filter((cycle) => {
      const topWeight = topIdx === null ? 0 : (cycle.cycleRows[cycleContext.stripIdx][topIdx] ?? 0);
      const botWeight = botIdx === null ? 0 : (cycle.cycleRows[cycleContext.stripIdx + 1][botIdx] ?? 0);
      return topWeight > 0 || botWeight > 0;
    });
  }

  function drawCycleOverlays(d, cycles) {
    if (!cycleContext || cycles.length === 0) return;
    cycles.forEach((cycle) => {
      appendCycleOverlay(svg, d, cycle, cycleContext.colors.get(cycle.label));
    });
  }

  function drawSegment(topIdx, botIdx, colorIdx = topIdx, cycles = supportedCycles(topIdx, botIdx)) {
    const d = pathD(topX[topIdx], topY, botX[botIdx], botY);
    appendPath(svg, d, generatorColor(before[colorIdx]));
    drawCycleOverlays(d, cycles);
  }

  function drawDirect(topIdx, botIdx) {
    drawSegment(topIdx, botIdx);
  }

  if (move.type === "tetra") {
    for (let idx = 0; idx < p; idx += 1) drawDirect(idx, idx);
    drawDirect(p, p + 1);
    drawDirect(p + 1, p);
    for (let idx = p + 2; idx < before.length; idx += 1) drawDirect(idx, idx);
  } else if (move.type === "hexa") {
    for (let idx = 0; idx < p; idx += 1) drawDirect(idx, idx);
    const vertexX = (topX[p] + topX[p + 1] + topX[p + 2]) / 3;
    const vertexY = (topY + botY) / 2;
      for (let local = 0; local < 3; local += 1) {
        const topD = pathD(topX[p + local], topY, vertexX, vertexY);
        const botD = pathD(vertexX, vertexY, botX[p + local], botY);
        appendPath(svg, topD, generatorColor(before[p + local]));
        drawCycleOverlays(topD, supportedCycles(p + local, null));
        appendPath(svg, botD, generatorColor(after[p + local]));
        drawCycleOverlays(botD, supportedCycles(null, p + local));
      }
    const dot = svgEl("circle");
    dot.setAttribute("cx", String(vertexX));
    dot.setAttribute("cy", String(vertexY));
    dot.setAttribute("r", "4");
    dot.setAttribute("class", "weave-move-dot");
    svg.appendChild(dot);
    for (let idx = p + 3; idx < before.length; idx += 1) drawDirect(idx, idx);
  } else if (move.type === "octa") {
    for (let idx = 0; idx < p; idx += 1) drawDirect(idx, idx);
    const vertexX = (topX[p] + topX[p + 1] + topX[p + 2] + topX[p + 3]) / 4;
    const vertexY = (topY + botY) / 2;
    for (let local = 0; local < 4; local += 1) {
      const topD = pathD(topX[p + local], topY, vertexX, vertexY);
      const botD = pathD(vertexX, vertexY, botX[p + local], botY);
      appendPath(svg, topD, generatorColor(before[p + local]));
      drawCycleOverlays(topD, supportedCycles(p + local, null));
      appendPath(svg, botD, generatorColor(after[p + local]));
      drawCycleOverlays(botD, supportedCycles(null, p + local));
    }
    const dot = svgEl("circle");
    dot.setAttribute("cx", String(vertexX));
    dot.setAttribute("cy", String(vertexY));
    dot.setAttribute("r", "4.6");
    dot.setAttribute("class", "weave-move-dot");
    svg.appendChild(dot);
    appendText(svg, vertexX + 10, vertexY - 8, "8", "weave-virtual-label");
    for (let idx = p + 4; idx < before.length; idx += 1) drawDirect(idx, idx);
  } else if (move.type === "tri") {
    for (let idx = 0; idx < p; idx += 1) drawDirect(idx, idx);
    const vertexX = (topX[p] + topX[p + 1] + botX[p]) / 3;
    const vertexY = (topY + botY) / 2;
    const leftD = pathD(topX[p], topY, vertexX, vertexY);
    const rightD = pathD(topX[p + 1], topY, vertexX, vertexY);
    const outD = pathD(vertexX, vertexY, botX[p], botY);
    appendPath(svg, leftD, generatorColor(before[p]));
    drawCycleOverlays(leftD, supportedCycles(p, null));
    appendPath(svg, rightD, generatorColor(before[p + 1]));
    drawCycleOverlays(rightD, supportedCycles(p + 1, null));
    appendPath(svg, outD, generatorColor(after[p]));
    drawCycleOverlays(outD, supportedCycles(null, p));
    const virtualXs = [];
    for (let idx = p + 2; idx < before.length; idx += 1) {
      virtualXs.push((topX[idx] + botX[idx - 1]) / 2);
    }
    if (showDashedRay) {
      const segmentXs = [vertexX, ...virtualXs, width - 42];
      for (let segIdx = 0; segIdx < segmentXs.length - 1; segIdx += 1) {
        const startGap = segIdx === 0 ? 7 : 5;
        const endGap = segIdx === segmentXs.length - 2 ? 0 : 5;
        const [x1, x2] = insetHorizontalSegment(segmentXs[segIdx], segmentXs[segIdx + 1], startGap, endGap);
        const ray = svgEl("line");
        ray.setAttribute("x1", String(x1));
        ray.setAttribute("y1", String(vertexY));
        ray.setAttribute("x2", String(x2));
        ray.setAttribute("y2", String(vertexY));
        ray.setAttribute("class", "weave-dashed-ray");
        svg.appendChild(ray);
      }
    }
    const dot = svgEl("circle");
    dot.setAttribute("cx", String(vertexX));
    dot.setAttribute("cy", String(vertexY));
    dot.setAttribute("r", "5");
    dot.setAttribute("class", "weave-tri-dot");
    svg.appendChild(dot);
    if (triInfo) appendWeaveVertexBadge(svg, vertexX + 14, vertexY - 12, triInfo.clusterVariable);
    let virtualIndex = 1;
    for (let idx = p + 2; idx < before.length; idx += 1) {
      drawDirect(idx, idx - 1);
      const virtualX = virtualXs[virtualIndex - 1];
      if (showDashedRay) {
        const virtual = svgEl("circle");
        virtual.setAttribute("cx", String(virtualX));
        virtual.setAttribute("cy", String(vertexY));
        virtual.setAttribute("r", "3.2");
        virtual.setAttribute("class", "weave-virtual-dot");
        svg.appendChild(virtual);
        if (showVirtualLabels) {
          appendText(svg, virtualX + 6, vertexY + 15, `v${virtualIndex}`, "weave-virtual-label");
        }
      }
      virtualIndex += 1;
    }
  }

  if (showBoundaryLabels) {
    before.forEach((generator, idx) => {
      appendText(svg, topX[idx], topY - 10, String(generator));
      if (showEdgeNumbers) appendText(svg, topX[idx], topY - 26, `e${idx + 1}`, "weave-edge-number");
    });
    after.forEach((generator, idx) => {
      appendText(svg, botX[idx], botY + 18, String(generator), "weave-bottom-label");
      if (showEdgeNumbers) appendText(svg, botX[idx], botY + 34, `e${idx + 1}`, "weave-edge-number");
    });
  }
}

function clusterValuesForDisplay(trace) {
  if (trace.fullClusterValuesOmitted) return trace.bottomWeave.clusterValues ?? [];
  return (trace.fullClusterValues?.length ? trace.fullClusterValues : trace.bottomWeave.clusterValues) ?? [];
}

function renderSmallMatrix(rows) {
  const matrix = el("table", "pinning-matrix");
  const body = el("tbody");
  rows.forEach((row) => {
    const tr = el("tr");
    row.forEach((entry) => {
      const td = el("td");
      td.appendChild(formulaSpan(entry));
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
  matrix.appendChild(body);
  return matrix;
}

function basisOrderText(rank) {
  const positive = Array.from({ length: rank }, (_, idx) => `e_${idx + 1}`);
  const negative = Array.from({ length: rank }, (_, idx) => `e_{-${rank - idx}}`);
  return `basis=(${[...positive, ...negative].join(",")})`;
}

function basisOrderTextB(rank) {
  const positive = Array.from({ length: rank }, (_, idx) => `e_${idx + 1}`);
  const negative = Array.from({ length: rank }, (_, idx) => `e_{-${rank - idx}}`);
  return `basis=(${[...positive, "e_0", ...negative].join(",")})`;
}

function basisOrderTextA(rank) {
  const basis = Array.from({ length: rank + 1 }, (_, idx) => `e_${idx + 1}`);
  return `basis=(${basis.join(",")})`;
}

function renderPinningFormulaLine(text) {
  const line = el("div", "pinning-formula-line");
  line.appendChild(formulaSpan(text, "formula"));
  return line;
}

function renderPhiBlock(firstPair, secondPair = null) {
  const block = el("div", "pinning-phi-block");
  const title = el("div", "pinning-block-label", "φ_i(A)");
  block.appendChild(title);

  const planes = el("div", "pinning-phi-grid");
  const first = el("div", "pinning-phi-plane");
  first.appendChild(formulaSpan(`on ${firstPair}`, "formula pinning-plane-label"));
  first.appendChild(renderSmallMatrix([["a", "b"], ["c", "d"]]));

  planes.appendChild(first);
  if (secondPair !== null) {
    const second = el("div", "pinning-phi-plane");
    second.appendChild(formulaSpan(`on ${secondPair}`, "formula pinning-plane-label"));
    second.appendChild(renderSmallMatrix([["a", "-b"], ["-c", "d"]]));
    planes.appendChild(second);
  }
  block.appendChild(planes);
  block.appendChild(el("p", "small-note pinning-fixed-note", "All other basis vectors are fixed."));
  return block;
}

function pinningANodePosition(rank, node) {
  const margin = 24;
  const step = 42;
  return { x: margin + step * (node - 1), y: 44 };
}

function pinningDNodePosition(rank, node) {
  const margin = 24;
  const step = 42;
  if (node <= rank - 2) {
    return { x: margin + step * (node - 1), y: 44 };
  }
  return {
    x: margin + step * (rank - 2),
    y: node === rank - 1 ? 20 : 68,
  };
}

function pinningBNodePosition(rank, node) {
  const margin = 24;
  const step = 42;
  return { x: margin + step * (node - 1), y: 44 };
}

function renderPinningDynkinA(rank, selected, onSelect) {
  const margin = 24;
  const step = 42;
  const width = margin * 2 + step * (rank - 1);
  const height = 88;
  const svg = svgEl("svg");
  svg.setAttribute("class", "pinning-dynkin-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Dynkin diagram of type A_${rank}`);

  for (let node = 1; node <= rank - 1; node += 1) {
    const pa = pinningANodePosition(rank, node);
    const pb = pinningANodePosition(rank, node + 1);
    const line = svgEl("line");
    line.setAttribute("x1", String(pa.x));
    line.setAttribute("y1", String(pa.y));
    line.setAttribute("x2", String(pb.x));
    line.setAttribute("y2", String(pb.y));
    line.setAttribute("class", "pinning-dynkin-edge");
    svg.appendChild(line);
  }

  for (let node = 1; node <= rank; node += 1) {
    const point = pinningANodePosition(rank, node);
    const group = svgEl("g");
    group.setAttribute("class", `pinning-dynkin-node${node === selected ? " active" : ""}`);
    group.setAttribute("role", "button");
    group.setAttribute("tabindex", "0");
    group.setAttribute("aria-label", `simple root ${node}`);
    group.addEventListener("click", () => onSelect(node));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(node);
      }
    });
    const circle = svgEl("circle");
    circle.setAttribute("cx", String(point.x));
    circle.setAttribute("cy", String(point.y));
    circle.setAttribute("r", "12");
    const text = svgEl("text");
    text.setAttribute("x", String(point.x));
    text.setAttribute("y", String(point.y + 4));
    text.textContent = String(node);
    group.append(circle, text);
    svg.appendChild(group);
  }
  return svg;
}

function renderPinningDynkinB(rank, selected, onSelect) {
  const margin = 24;
  const step = 42;
  const width = margin * 2 + step * (rank - 1);
  const height = 88;
  const svg = svgEl("svg");
  svg.setAttribute("class", "pinning-dynkin-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Dynkin diagram of type B_${rank}`);

  function drawLine(a, b, offsetY = 0) {
    const pa = pinningBNodePosition(rank, a);
    const pb = pinningBNodePosition(rank, b);
    const line = svgEl("line");
    line.setAttribute("x1", String(pa.x));
    line.setAttribute("y1", String(pa.y + offsetY));
    line.setAttribute("x2", String(pb.x));
    line.setAttribute("y2", String(pb.y + offsetY));
    line.setAttribute("class", "pinning-dynkin-edge");
    svg.appendChild(line);
  }

  for (let node = 1; node <= rank - 2; node += 1) drawLine(node, node + 1);
  if (rank >= 2) {
    drawLine(rank - 1, rank, -3);
    drawLine(rank - 1, rank, 3);
    const short = pinningBNodePosition(rank, rank);
    const arrow = svgEl("path");
    arrow.setAttribute("d", `M ${short.x - 12} ${short.y} L ${short.x - 21} ${short.y - 6} L ${short.x - 21} ${short.y + 6} Z`);
    arrow.setAttribute("class", "pinning-dynkin-edge");
    arrow.setAttribute("fill", "#64748b");
    svg.appendChild(arrow);
  }

  for (let node = 1; node <= rank; node += 1) {
    const point = pinningBNodePosition(rank, node);
    const group = svgEl("g");
    group.setAttribute("class", `pinning-dynkin-node${node === selected ? " active" : ""}`);
    group.setAttribute("role", "button");
    group.setAttribute("tabindex", "0");
    group.setAttribute("aria-label", `simple root ${node}`);
    group.addEventListener("click", () => onSelect(node));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(node);
      }
    });
    const circle = svgEl("circle");
    circle.setAttribute("cx", String(point.x));
    circle.setAttribute("cy", String(point.y));
    circle.setAttribute("r", node === rank ? "10" : "12");
    const text = svgEl("text");
    text.setAttribute("x", String(point.x));
    text.setAttribute("y", String(point.y + 4));
    text.textContent = String(node);
    group.append(circle, text);
    svg.appendChild(group);
  }
  return svg;
}

function renderPinningDynkinD(rank, selected, onSelect) {
  const margin = 24;
  const step = 42;
  const width = margin * 2 + step * (rank - 2);
  const height = 88;
  const svg = svgEl("svg");
  svg.setAttribute("class", "pinning-dynkin-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Dynkin diagram of type D_${rank}`);

  function drawEdge(a, b) {
    const pa = pinningDNodePosition(rank, a);
    const pb = pinningDNodePosition(rank, b);
    const line = svgEl("line");
    line.setAttribute("x1", String(pa.x));
    line.setAttribute("y1", String(pa.y));
    line.setAttribute("x2", String(pb.x));
    line.setAttribute("y2", String(pb.y));
    line.setAttribute("class", "pinning-dynkin-edge");
    svg.appendChild(line);
  }

  for (let node = 1; node <= rank - 3; node += 1) drawEdge(node, node + 1);
  drawEdge(rank - 2, rank - 1);
  drawEdge(rank - 2, rank);

  for (let node = 1; node <= rank; node += 1) {
    const point = pinningDNodePosition(rank, node);
    const group = svgEl("g");
    group.setAttribute("class", `pinning-dynkin-node${node === selected ? " active" : ""}`);
    group.setAttribute("role", "button");
    group.setAttribute("tabindex", "0");
    group.setAttribute("aria-label", `simple root ${node}`);
    group.addEventListener("click", () => onSelect(node));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(node);
      }
    });
    const circle = svgEl("circle");
    circle.setAttribute("cx", String(point.x));
    circle.setAttribute("cy", String(point.y));
    circle.setAttribute("r", "12");
    const text = svgEl("text");
    text.setAttribute("x", String(point.x));
    text.setAttribute("y", String(point.y + 4));
    text.textContent = String(node);
    group.append(circle, text);
    svg.appendChild(group);
  }
  return svg;
}

function renderPinningNodeInfoA(rank, node) {
  const panel = el("div", "pinning-node-info");
  const pair = `(e_${node}, e_${node + 1})`;

  const header = el("div", "pinning-node-header");
  header.appendChild(formulaSpan(`node ${node}: φ_${node}`, "formula pinning-node-title"));
  panel.appendChild(header);

  const domain = el("div", "pinning-domain-row");
  domain.appendChild(formulaSpan("A=", "formula pinning-domain-label"));
  domain.appendChild(renderSmallMatrix([["a", "b"], ["c", "d"]]));
  domain.appendChild(formulaSpan("in SL_2(C)", "formula pinning-domain-label"));
  panel.appendChild(domain);

  panel.appendChild(renderPhiBlock(pair));

  const derivedDetails = el("details", "pinning-derived");
  derivedDetails.appendChild(el("summary", "", "B_i(z) from φ_i"));
  derivedDetails.appendChild(renderPinningFormulaLine("x_i(z)=φ_i([[1,z],[0,1]])"));
  derivedDetails.appendChild(renderPinningFormulaLine("dot{s_i}=φ_i([[0,-1],[1,0]])"));
  derivedDetails.appendChild(renderPinningFormulaLine("B_i(z)=φ_i([[z,-1],[1,0]])"));
  panel.appendChild(derivedDetails);
  return panel;
}

function renderPinningNodeInfoD(rank, node) {
  const panel = el("div", "pinning-node-info");
  const next = node + 1;
  const firstPair = node < rank
    ? `(e_${node}, e_${next})`
    : `(e_${rank - 1}, e_{-${rank}})`;
  const secondPair = node < rank
    ? `(e_{-${next}}, e_{-${node}})`
    : `(e_${rank}, e_{-${rank - 1}})`;

  const header = el("div", "pinning-node-header");
  header.appendChild(formulaSpan(`node ${node}: φ_${node}`, "formula pinning-node-title"));
  panel.appendChild(header);

  const domain = el("div", "pinning-domain-row");
  domain.appendChild(formulaSpan("A=", "formula pinning-domain-label"));
  domain.appendChild(renderSmallMatrix([["a", "b"], ["c", "d"]]));
  domain.appendChild(formulaSpan("in SL_2(C)", "formula pinning-domain-label"));
  panel.appendChild(domain);

  panel.appendChild(renderPhiBlock(firstPair, secondPair));

  const derivedDetails = el("details", "pinning-derived");
  derivedDetails.appendChild(el("summary", "", "B_i(z) from φ_i"));
  derivedDetails.appendChild(renderPinningFormulaLine("x_i(z)=φ_i([[1,z],[0,1]])"));
  derivedDetails.appendChild(renderPinningFormulaLine("dot{s_i}=φ_i([[0,-1],[1,0]])"));
  derivedDetails.appendChild(renderPinningFormulaLine("B_i(z)=φ_i([[z,-1],[1,0]])"));
  panel.appendChild(derivedDetails);
  return panel;
}

function renderPinningNodeInfoB(rank, node) {
  const panel = el("div", "pinning-node-info");
  const header = el("div", "pinning-node-header");
  header.appendChild(formulaSpan(`node ${node}: φ_${node}`, "formula pinning-node-title"));
  panel.appendChild(header);

  const domain = el("div", "pinning-domain-row");
  domain.appendChild(formulaSpan("A=", "formula pinning-domain-label"));
  domain.appendChild(renderSmallMatrix([["a", "b"], ["c", "d"]]));
  domain.appendChild(formulaSpan("in SL_2(C)", "formula pinning-domain-label"));
  panel.appendChild(domain);

  if (node < rank) {
    const next = node + 1;
    panel.appendChild(renderPhiBlock(`(e_${node}, e_${next})`, `(e_{-${next}}, e_{-${node}})`));
  } else {
    const block = el("div", "pinning-phi-block");
    block.appendChild(el("div", "pinning-block-label", "φ_n(A)"));
    const plane = el("div", "pinning-phi-plane");
    plane.appendChild(formulaSpan(`on (e_${rank}, e_0, e_{-${rank}})`, "formula pinning-plane-label"));
    plane.appendChild(renderSmallMatrix([
      ["a^2", "ab", "b^2"],
      ["2ac", "ad+bc", "2bd"],
      ["c^2", "cd", "d^2"],
    ]));
    block.appendChild(plane);
    block.appendChild(el("p", "small-note pinning-fixed-note", "All other basis vectors are fixed."));
    panel.appendChild(block);
  }

  const derivedDetails = el("details", "pinning-derived");
  derivedDetails.appendChild(el("summary", "", "B_i(z) from φ_i"));
  derivedDetails.appendChild(renderPinningFormulaLine("x_i(z)=φ_i([[1,z],[0,1]])"));
  derivedDetails.appendChild(renderPinningFormulaLine("dot{s_i}=φ_i([[0,-1],[1,0]])"));
  derivedDetails.appendChild(renderPinningFormulaLine("B_i(z)=φ_i([[z,-1],[1,0]])"));
  panel.appendChild(derivedDetails);
  return panel;
}

function renderPinningDetails(trace) {
  const info = trace.bottomWeave.pinningInfo;
  if (!trace.bottomWeave.coordinateAvailable || !info) return null;
  const rank = trace.rank;
  const family = info.family;
  if (family !== "A" && family !== "B" && family !== "D") return null;

  const details = el("details", "pinning-details variable-pinning-details");
  const summary = el("summary");
  summary.textContent = "Pinning";
  details.appendChild(summary);

  const role = el("p", "pinning-intro");
  role.append("A pinning fixes ");
  role.appendChild(formulaSpan("φ_i:SL_2(C)->G"));
  role.append(" for each node ");
  role.appendChild(formulaSpan("i"));
  role.append(".");
  details.appendChild(role);

  const basis = el("div", "pinning-basis");
  if (family === "A") {
    basis.appendChild(formulaSpan(`G=SL_${rank + 1}(C)`));
    basis.appendChild(formulaSpan(`V=C^{${rank + 1}}`));
    basis.appendChild(formulaSpan(basisOrderTextA(rank)));
  } else if (family === "B") {
    basis.appendChild(formulaSpan(`G=SO_${2 * rank + 1}(C)`));
    basis.appendChild(formulaSpan(`V=C^{${2 * rank + 1}}`));
    basis.appendChild(formulaSpan(basisOrderTextB(rank)));
  } else {
    basis.appendChild(formulaSpan(`G=SO_${2 * rank}(C)`));
    basis.appendChild(formulaSpan(`V=C^{${2 * rank}}`));
    basis.appendChild(formulaSpan(basisOrderText(rank)));
  }
  details.appendChild(basis);

  const interactive = el("div", "pinning-interactive");
  const diagramSlot = el("div", "pinning-diagram-slot");
  const infoSlot = el("div", "pinning-info-slot");
  let selected = 1;
  function update(node) {
    selected = node;
    if (family === "A") {
      diagramSlot.replaceChildren(renderPinningDynkinA(rank, selected, update));
      infoSlot.replaceChildren(renderPinningNodeInfoA(rank, selected));
    } else if (family === "B") {
      diagramSlot.replaceChildren(renderPinningDynkinB(rank, selected, update));
      infoSlot.replaceChildren(renderPinningNodeInfoB(rank, selected));
    } else {
      diagramSlot.replaceChildren(renderPinningDynkinD(rank, selected, update));
      infoSlot.replaceChildren(renderPinningNodeInfoD(rank, selected));
    }
  }
  interactive.append(diagramSlot, infoSlot);
  details.appendChild(interactive);
  update(selected);
  return details;
}

export function renderClusterVariableAnswerPanel(trace, cycleColors, onSelect = null, onClear = null, options = {}) {
  const weaveLabel = options.weaveLabel ?? "𝒲_{Δ̲}(ℭ)";
  const variableHeader = options.variableHeader ?? `A_t = A_t(${weaveLabel})`;
  const values = clusterValuesForDisplay(trace);
  const formulasAvailable = !trace.fullClusterValuesOmitted;
  const quiver = trace.bottomWeave.quiverData ?? { frozen: [] };
  const graphName = quiver.ordinaryQuiver === false ? "exchange graph" : "quiver";
  const frozen = new Set(quiver.frozen ?? []);
  const panel = el("div", "answer-panel cluster-answer-panel");
  const header = el("div", "answer-panel-header");
  header.appendChild(el("h3", "", "Cluster Variables"));
  const headerRight = el("div", "answer-panel-actions");
  headerRight.appendChild(mathText(variableHeader));
  if (onClear) {
    const allButton = el("button", "clear-selection-button", "Clear");
    allButton.type = "button";
    allButton.title = "Clear the current selection";
    allButton.addEventListener("click", onClear);
    headerRight.appendChild(allButton);
  }
  header.appendChild(headerRight);
  panel.appendChild(header);
  const note = el("p", "small-note");
  if (trace.fullClusterValuesOmitted && trace.fullClusterValuesOmittedReason) {
    note.append(trace.fullClusterValuesOmittedReason);
    note.append(` The vertices and ${graphName} remain selectable.`);
  } else if (trace.fullClusterValuesOmitted) {
    note.append("For this large example, the expanded ");
    note.appendChild(formulaSpan("A_t"));
    note.append(` formulas are omitted; the vertices and ${graphName} remain selectable.`);
  } else if (trace.foldedClusterComputation) {
    note.append("Cluster variables computed by the CGG unfolding construction to ");
    note.appendChild(formulaSpan(trace.foldedClusterComputation.unfoldedType));
    note.append(" and restriction to the folded fixed locus.");
  } else if (onSelect) {
    note.append("Cluster variables attached to the trivalent vertices of ");
    note.appendChild(formulaSpan(weaveLabel));
    note.append(".");
  } else {
    note.append("These are the cluster variables attached to the trivalent vertices of ");
    note.appendChild(formulaSpan(weaveLabel));
    note.append(".");
  }
  panel.appendChild(note);

  if (values.length === 0) {
    panel.appendChild(el("p", "small-note", "No trivalent vertex occurs."));
    const pinningDetails = renderPinningDetails(trace);
    if (pinningDetails) panel.appendChild(pinningDetails);
    return panel;
  }

  const list = el("div", "cluster-answer-list");
  values.forEach((value) => {
    const item = el("div", onSelect ? "cluster-answer-item selectable" : "cluster-answer-item");
    item.dataset.cluster = value.label;
    item.style.setProperty("--cycle-color", cycleColors.get(value.label) ?? "#3b82f6");
    if (onSelect) {
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.setAttribute("aria-label", `highlight ${clusterVariableText(value.label)}`);
      item.addEventListener("click", (event) => {
        if (event.target.closest("details")) return;
        onSelect(value.label);
      });
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(value.label);
        }
      });
    }
    const label = el("span", "cluster-answer-label");
    label.appendChild(formulaSpan(clusterVariableText(value.label), "formula"));
    item.appendChild(label);
    const content = el("div", "cluster-answer-content");
    if (formulasAvailable) {
      content.appendChild(formulaSpan(value.expression, "cluster-answer-expression formula"));
    } else {
      content.appendChild(el("span", "cluster-answer-meta", "formula expansion omitted"));
    }
    const meta = el("span", "cluster-answer-meta", `${frozen.has(value.label) ? "frozen" : "mutable"}`);
    content.appendChild(meta);
    if (value.substitutionWarning || value.expansionWarning) {
      content.appendChild(el("p", "small-note", value.substitutionWarning || value.expansionWarning));
    }
    item.appendChild(content);
    list.appendChild(item);
  });
  panel.appendChild(list);
  const pinningDetails = renderPinningDetails(trace);
  if (pinningDetails) panel.appendChild(pinningDetails);
  return panel;
}

export function renderInteractiveWeaveViewer(trace, {
  initialLabel = null,
  cycleColors = null,
  onSelectionChange = null,
} = {}) {
  const top = trace.topWeave;
  const weave = trace.bottomWeave;
  const bottomByLabel = new Map((trace.bottomWeave.clusterValues ?? []).map((item) => [item.label, item]));
  const fullByLabel = new Map((trace.fullClusterValues ?? []).map((item) => [item.label, item]));
  const rayByLabel = new Map((trace.bottomWeave.dashedRays ?? []).map((item) => [item.label, item]));
  const quiverData = trace.bottomWeave.quiverData ?? { arrows: [] };
  const cycleOverlayAvailable = quiverData.cycleOverlayAvailable !== false;
  const intersectionEvidenceAvailable = quiverData.intersectionEvidenceAvailable !== false;
  const colors = cycleColors ?? new Map(weave.lusztigCycles.map((cycle, idx) => [cycle.label, cycleColor(idx)]));
  const cycleByLabel = new Map(weave.lusztigCycles.map((cycle) => [cycle.label, cycle]));
  const allWords = [...top.words, ...weave.words.slice(1)];
  const maxRowLength = Math.max(...allWords.map((row) => row.length), 1);
  const spacing = 30;
  const rowHeight = 42;
  const marginX = 72;
  const marginTop = 48;
  const marginBottom = 34;
  const junctionExtra = 34;
  const topBoundaryYs = [marginTop];
  top.moves.forEach((_, idx) => {
    topBoundaryYs.push(topBoundaryYs[idx] + rowHeight + (idx === top.moves.length - 1 ? junctionExtra / 2 : 0));
  });
  const junctionY = topBoundaryYs[topBoundaryYs.length - 1];
  const bottomBoundaryYs = [junctionY];
  weave.moves.forEach((_, idx) => {
    bottomBoundaryYs.push(bottomBoundaryYs[idx] + rowHeight + (idx === 0 ? junctionExtra / 2 : 0));
  });
  const width = Math.max(780, marginX * 2 + maxRowLength * spacing + 150);
  const height = Math.max(190, bottomBoundaryYs[bottomBoundaryYs.length - 1] + marginBottom);
  const center = width / 2;
  const svg = svgEl("svg");
  svg.setAttribute("class", "edge-label-viewer-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");

  const background = svgEl("rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(width));
  background.setAttribute("height", String(height));
  background.setAttribute("fill", "white");
  background.setAttribute("class", "viewer-background");
  svg.appendChild(background);

  const evidenceDefs = svgEl("defs");
  const blackMarker = svgEl("marker");
  blackMarker.setAttribute("id", "weave-evidence-arrowhead-black");
  blackMarker.setAttribute("markerWidth", "8");
  blackMarker.setAttribute("markerHeight", "6");
  blackMarker.setAttribute("refX", "7.2");
  blackMarker.setAttribute("refY", "3");
  blackMarker.setAttribute("orient", "auto");
  const blackHead = svgEl("polygon");
  blackHead.setAttribute("points", "0 0, 8 3, 0 6");
  blackHead.setAttribute("fill", "#111827");
  blackMarker.appendChild(blackHead);
  evidenceDefs.appendChild(blackMarker);
  svg.appendChild(evidenceDefs);

  function drawViewerMove(part, stripMove, idx, topY, botY) {
    drawStripGeometry(svg, {
      before: part.words[idx],
      after: part.words[idx + 1],
      move: stripMove,
      triInfo: part === weave ? triInfoForStrip(weave, idx) : null,
      width,
      topY,
      botY,
      center,
      spacing,
      showBoundaryLabels: false,
      showDashedRay: part === weave,
      cycleContext: part === weave && cycleOverlayAvailable
        ? {
          stripIdx: idx,
          cycles: weave.lusztigCycles,
          colors,
        }
        : null,
    });
  }

  top.moves.forEach((stripMove, idx) => drawViewerMove(top, stripMove, idx, topBoundaryYs[idx], topBoundaryYs[idx + 1]));
  const divider = svgEl("line");
  divider.setAttribute("x1", "18");
  divider.setAttribute("x2", String(width - 18));
  divider.setAttribute("y1", String(junctionY));
  divider.setAttribute("y2", String(junctionY));
  divider.setAttribute("class", "full-weave-divider");
  svg.appendChild(divider);
  appendText(svg, 22, junctionY - 6, trace.junctionLabel ?? "i_{Δ̲}(ℭ)", "full-weave-junction-label");

  [...(trace.layerStrips ?? [])]
    .sort((left, right) => Number(Boolean(left.empty)) - Number(Boolean(right.empty)))
    .forEach((layer) => {
    if (!Number.isInteger(layer.startMove) || !Number.isInteger(layer.endMove)) return;
    if (layer.startMove < 0 || layer.startMove > bottomBoundaryYs.length - 1) return;
    const emptyLayer = layer.empty || layer.endMove <= layer.startMove;
    if (!emptyLayer && layer.endMove > bottomBoundaryYs.length - 1) return;
    const topY = bottomBoundaryYs[layer.startMove];
    const botY = emptyLayer ? topY + 22 : bottomBoundaryYs[layer.endMove];
    const band = svgEl("rect");
    band.setAttribute("x", "24");
    band.setAttribute("y", String(topY + 3));
    band.setAttribute("width", String(width - 48));
    band.setAttribute("height", String(Math.max(14, botY - topY - 6)));
    band.setAttribute("rx", "8");
    band.setAttribute("class", [
      "weave-layer-band",
      layer.caseType ?? "",
      layer.active ? "active" : "",
      emptyLayer ? "empty" : "",
    ].filter(Boolean).join(" "));
    svg.appendChild(band);

    const label = svgEl("text");
    label.setAttribute("x", "31");
    label.setAttribute("y", String(topY + 17));
    label.setAttribute("class", [
      "weave-layer-band-label",
      layer.caseType ?? "",
      layer.active ? "active" : "",
    ].filter(Boolean).join(" "));
    label.textContent = layer.label ?? `t=${layer.layer}`;
    svg.appendChild(label);
    });

  weave.moves.forEach((stripMove, idx) => {
    drawViewerMove(weave, stripMove, idx, bottomBoundaryYs[idx], bottomBoundaryYs[idx + 1]);
  });

  const topXs = rowXPositions(top.sourceWord.length, center, spacing);
  top.sourceWord.forEach((generator, idx) => {
    appendText(svg, topXs[idx], marginTop - 26, top.sourceCoordinates[idx] ?? "", "top-coordinate-label");
    appendText(svg, topXs[idx], marginTop - 9, String(generator), "weave-label");
  });

  const panel = el("div", "edge-label-viewer");
  const figureWrap = el("div", "edge-label-viewer-figure");
  const info = el("div", "edge-label-info");
  let selectedKey = null;
  let selectedClusterLabel = null;
  let selectedArrowKey = null;
  let cyclesVisible = false;
  let focusedCycleLabels = new Set();
  let primaryCycleLabel = null;
  let visibleEvidenceArrowKeys = new Set();

  function quiverArrowKey(source, target) {
    return `${source}->${target}`;
  }

  function incidentQuiverArrows(label) {
    return (quiverData.arrows ?? []).filter((arrow) => arrow.source === label || arrow.target === label);
  }

  function topEdgeData(rowIdx, edgeIdx) {
    return {
      kind: "edge",
      key: `top:${rowIdx}:${edgeIdx}`,
      rowIdx,
      edgeIdx,
      color: top.words[rowIdx]?.[edgeIdx] ?? "",
      z: topCoordinateExpression(trace, top.coordinateRows?.[rowIdx]?.[edgeIdx] ?? ""),
      u: "1",
    };
  }

  function edgeData(rowIdx, edgeIdx) {
    return {
      kind: "edge",
      key: `${rowIdx}:${edgeIdx}`,
      rowIdx,
      edgeIdx,
      localName: "",
      color: weave.words[rowIdx]?.[edgeIdx] ?? "",
      z: topCoordinateExpression(trace, weave.zRows[rowIdx]?.[edgeIdx] ?? ""),
      u: topCoordinateExpression(trace, weave.uRows[rowIdx]?.[edgeIdx] ?? ""),
    };
  }

  function clusterData(label) {
    const bottomValue = bottomByLabel.get(label);
    const fullValue = fullByLabel.get(label) ?? bottomValue;
    return {
      kind: "cluster",
      key: `cluster:${label}`,
      label,
      bottom: expandedExpression(trace, bottomValue?.expression ?? ""),
      final: fullValue?.expression ?? "",
      strip: bottomValue?.triMoveIndex ?? 0,
      frozen: new Set(weave.quiverData?.frozen ?? []).has(label),
    };
  }

  function dashedSegmentData(ray, segmentIndex) {
    const matrix = segmentIndex === 0
      ? ray.initialY
      : ray.crossings?.[segmentIndex - 1]?.yAfter ?? ray.finalY;
    return {
      kind: "dashed",
      key: `dashed:${ray.label}:${segmentIndex}`,
      label: ray.label,
      segmentIndex,
      matrix,
    };
  }

  function renderEmptyInfo() {
    info.replaceChildren();
    const title = el("div", "edge-label-info-title");
    title.appendChild(el("strong", "", "Selected object"));
    info.appendChild(title);
    const note = el("p", "small-note");
    note.append("Click a solid edge for ");
    note.appendChild(formulaSpan("ζ(e)"));
    note.append(", a dashed edge for ");
    note.appendChild(formulaSpan("Y_j"));
    note.append(", or a trivalent vertex for ");
    note.appendChild(formulaSpan(`A_t(${trace.weaveTitle ?? "𝒲_{Δ̲}(ℭ)"})`));
    note.append(".");
    info.appendChild(note);
  }

  function appendInfoClearButton(title) {
    const button = el("button", "selection-clear-button", "Clear");
    button.type = "button";
    button.addEventListener("click", () => clearViewerSelection());
    title.appendChild(button);
  }

  function renderEdgeInfo(data) {
    info.replaceChildren();
    const title = el("div", "edge-label-info-title");
    const titleText = data.localName ? `ζ(${data.localName})` : "ζ(e)";
    const titleLabel = el("strong");
    titleLabel.appendChild(formulaSpan(titleText));
    title.appendChild(titleLabel);
    appendInfoClearButton(title);
    info.appendChild(title);
    const values = el("div", "variable-value-list");
    values.appendChild(renderValueBlock("z̃_e", formulaSpan(data.z)));
    values.appendChild(renderValueBlock("u_e", formulaSpan(data.u)));
    info.appendChild(values);
  }

  function renderClusterInfo(data) {
    info.replaceChildren();
    const title = el("div", "edge-label-info-title");
    title.appendChild(el("span", "summary-label", "trivalent vertex"));
    title.appendChild(el("strong", "", clusterIndexText(data.label)));
    title.appendChild(el("span", "cluster-answer-meta", data.frozen ? "frozen" : "mutable"));
    appendInfoClearButton(title);
    info.appendChild(title);
    const values = el("div", "variable-value-list");
    const expression = data.final || topCoordinateExpression(trace, data.bottom);
    values.appendChild(renderValueBlock(
      `${clusterVariableText(data.label)}(${trace.weaveTitle ?? "𝒲_{Δ̲}(ℭ)"})`,
      expression ? formulaSpan(expression) : el("span", "cluster-answer-meta", "coordinate formula unavailable"),
    ));
    info.appendChild(values);
  }

  function renderDashedInfo(data) {
    info.replaceChildren();
    const title = el("div", "edge-label-info-title");
    title.appendChild(el("span", "summary-label", "dashed edge"));
    title.appendChild(el("strong", "", `Y_${data.segmentIndex}`));
    title.appendChild(el("span", "cluster-answer-meta", `trivalent vertex ${clusterIndexText(data.label)}`));
    appendInfoClearButton(title);
    info.appendChild(title);
    const values = el("div", "variable-value-list");
    values.appendChild(renderValueBlock(
      `Y_${data.segmentIndex}`,
      renderMatrixEntries(data.matrix, (expr) => topCoordinateExpression(trace, expr)),
    ));
    info.appendChild(values);
  }

  function contributionText(entry) {
    if (entry.kind === "tri") return `trivalent strip ${entry.stripIdx + 1}`;
    if (entry.kind === "hexa") return `hexavalent strip ${entry.stripIdx + 1}`;
    if (entry.kind === "octa") return `octavalent strip ${entry.stripIdx + 1}`;
    if (entry.kind === "bottom-boundary") return "bottom boundary";
    return entry.kind;
  }

  function renderQuiverArrowInfo(data) {
    info.replaceChildren();
    const title = el("div", "edge-label-info-title");
    title.appendChild(el("span", "summary-label", "quiver arrow"));
    title.appendChild(el("strong", "", `${clusterIndexText(data.source)} → ${clusterIndexText(data.target)}`));
    title.appendChild(el("span", "cluster-answer-meta", `weight ${data.weight}`));
    appendInfoClearButton(title);
    info.appendChild(title);

    const list = el("div", "quiver-evidence-list");
    const contributions = data.contributions ?? [];
    if (contributions.length === 0) {
      list.appendChild(el("div", "quiver-evidence-item", "No nonzero contribution is recorded."));
    } else {
      contributions.forEach((entry) => {
        const item = el("div", "quiver-evidence-item");
        item.appendChild(el("span", "quiver-evidence-source", contributionText(entry)));
        item.appendChild(el("span", "quiver-evidence-value", String(entry.value)));
        list.appendChild(item);
      });
    }
    info.appendChild(list);
  }

  function renderQuiverVertexInfo(data, incidentArrows) {
    renderClusterInfo(data);
    const list = el("div", "quiver-evidence-list");
    if (incidentArrows.length === 0) {
      list.appendChild(el("div", "quiver-evidence-item", "No incident quiver arrow."));
    } else {
      incidentArrows.forEach((arrow) => {
        const item = el("div", "quiver-evidence-item");
        const direction = arrow.source === data.label ? "outgoing" : "incoming";
        item.appendChild(el("span", "quiver-evidence-source", `${direction}: ${clusterIndexText(arrow.source)} → ${clusterIndexText(arrow.target)}`));
        item.appendChild(el("span", "quiver-evidence-value", String(arrow.weight)));
        list.appendChild(item);
      });
    }
    info.appendChild(list);
  }

  function syncCycleDisplay() {
    panel.classList.toggle("has-weave-focus", focusedCycleLabels.size > 0);
    svg.querySelectorAll(".cycle-overlay").forEach((path) => {
      const focused = focusedCycleLabels.has(path.dataset.cycle);
      const primary = primaryCycleLabel !== null && path.dataset.cycle === primaryCycleLabel;
      path.classList.toggle("hidden", !(cyclesVisible || focused));
      path.classList.toggle("active", focused && (selectedArrowKey !== null || primary));
      path.classList.toggle("focus-secondary", selectedArrowKey !== null && focused);
      path.classList.toggle("star-secondary", focused && primaryCycleLabel !== null && !primary);
    });
  }

  function syncEvidenceMarkers() {
    svg.querySelectorAll(".quiver-evidence-marker").forEach((node) => {
      node.classList.toggle("visible", visibleEvidenceArrowKeys.has(node.dataset.arrowKey));
      node.classList.toggle("star-evidence", primaryCycleLabel !== null && visibleEvidenceArrowKeys.has(node.dataset.arrowKey));
    });
  }

  function syncRelatedMarkers() {
    svg.querySelectorAll("[data-related-cluster]").forEach((node) => {
      node.classList.toggle("related", selectedClusterLabel !== null && node.dataset.relatedCluster === selectedClusterLabel);
    });
    svg.querySelectorAll(".selection-cluster-label").forEach((node) => {
      node.classList.toggle("visible", selectedKey?.startsWith("dashed:")
        && selectedClusterLabel !== null
        && node.dataset.relatedCluster === selectedClusterLabel);
    });
    syncCycleDisplay();
    syncEvidenceMarkers();
  }

  function selectItem(data, { notify = true, focusCycle = false } = {}) {
    selectedKey = data.key;
    selectedClusterLabel = data.kind === "cluster" || data.kind === "dashed" ? data.label : null;
    selectedArrowKey = null;
    primaryCycleLabel = null;
    visibleEvidenceArrowKeys = new Set();
    let incidentArrows = [];
    if (focusCycle && cycleOverlayAvailable && data.kind === "cluster" && selectedClusterLabel !== null) {
      incidentArrows = incidentQuiverArrows(selectedClusterLabel);
      primaryCycleLabel = selectedClusterLabel;
      focusedCycleLabels = new Set([
        selectedClusterLabel,
        ...incidentArrows.map((arrow) => (arrow.source === selectedClusterLabel ? arrow.target : arrow.source)),
      ]);
      visibleEvidenceArrowKeys = new Set(incidentArrows.map((arrow) => quiverArrowKey(arrow.source, arrow.target)));
    } else {
      focusedCycleLabels = new Set();
    }
    svg.querySelectorAll(".edge-label-segment, .cluster-vertex-node, .dashed-edge-node").forEach((node) => {
      node.classList.toggle("active", node.dataset.edgeKey === selectedKey);
    });
    panel.classList.add("has-selection");
    syncRelatedMarkers();
    if (data.kind === "cluster") {
      if (focusCycle) renderQuiverVertexInfo(data, incidentArrows);
      else renderClusterInfo(data);
    }
    else if (data.kind === "dashed") renderDashedInfo(data);
    else renderEdgeInfo(data);
    if (notify) onSelectionChange?.(data);
  }

  function clearViewerSelection({ notify = true } = {}) {
    selectedKey = null;
    selectedClusterLabel = null;
    selectedArrowKey = null;
    primaryCycleLabel = null;
    visibleEvidenceArrowKeys = new Set();
    focusedCycleLabels = new Set();
    svg.querySelectorAll(".edge-label-segment, .cluster-vertex-node, .dashed-edge-node").forEach((node) => {
      node.classList.remove("active");
    });
    panel.classList.remove("has-selection");
    syncRelatedMarkers();
    renderEmptyInfo();
    if (notify) onSelectionChange?.(null);
  }

  const solidEdgeSegments = [];

  background.addEventListener("click", () => clearViewerSelection());

  function solidBoundaryNode(partName, rowIdx, edgeIdx) {
    if ((partName === "top" && rowIdx === top.moves.length) || (partName === "bottom" && rowIdx === 0)) {
      return `junction:${edgeIdx}`;
    }
    return `${partName}:${rowIdx}:${edgeIdx}`;
  }

  function recordSegmentHitbox(d, data, startNode = null, endNode = null, label = null, labelX = null, labelY = null) {
    solidEdgeSegments.push({
      d,
      data,
      startNode,
      endNode,
      label,
      labelX,
      labelY,
    });
  }

  function appendSolidEdgeGroups() {
    const parent = solidEdgeSegments.map((_, idx) => idx);
    const nodeToSegments = new Map();
    function sameSolidLabel(left, right) {
      return left.data.z === right.data.z
        && left.data.u === right.data.u
        && left.data.color === right.data.color;
    }
    function find(idx) {
      let current = idx;
      while (parent[current] !== current) current = parent[current];
      while (parent[idx] !== idx) {
        const next = parent[idx];
        parent[idx] = current;
        idx = next;
      }
      return current;
    }
    function union(left, right) {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
    }
    solidEdgeSegments.forEach((segment, idx) => {
      [segment.startNode, segment.endNode].filter(Boolean).forEach((nodeKey) => {
        if (!nodeToSegments.has(nodeKey)) nodeToSegments.set(nodeKey, []);
        nodeToSegments.get(nodeKey).push(idx);
      });
    });
    nodeToSegments.forEach((indices) => {
      if (indices.length !== 2) return;
      const [leftIdx, rightIdx] = indices;
      if (sameSolidLabel(solidEdgeSegments[leftIdx], solidEdgeSegments[rightIdx])) union(leftIdx, rightIdx);
    });

    const groups = new Map();
    solidEdgeSegments.forEach((segment, idx) => {
      const root = find(idx);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(segment);
    });

    Array.from(groups.values()).forEach((segments, groupIdx) => {
      const representative = segments.find((segment) => segment.data.localName) ?? segments[0];
      const data = {
        ...representative.data,
        key: `solid-edge:${groupIdx}`,
      };
      const node = svgEl("path");
      node.setAttribute("d", segments.map((segment) => segment.d).join(" "));
      node.setAttribute("fill", "none");
      node.setAttribute("class", segments.some((segment) => segment.data.localName) ? "edge-label-segment related" : "edge-label-segment");
      node.setAttribute("tabindex", "0");
      node.setAttribute("role", "button");
      node.setAttribute("aria-label", data.localName ? `show ${data.localName}` : "show edge labels");
      node.dataset.edgeKey = data.key;
      node.addEventListener("click", () => selectItem(data));
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectItem(data);
        }
      });
      svg.appendChild(node);
    });

    solidEdgeSegments.forEach((segment) => {
      if (segment.label) appendText(svg, segment.labelX, segment.labelY, segment.label, "edge-label-local-name");
    });
  }

  function addClickableSegments(partName, part, moveList, yRows, dataAt) {
    moveList.forEach((stripMove, idx) => {
      const before = part.words[idx];
      const after = part.words[idx + 1];
      const topY = yRows[idx];
      const botY = yRows[idx + 1];
      const topX = rowXPositions(before.length, center, spacing);
      const botX = rowXPositions(after.length, center, spacing);
      const q = stripMove.pos;

      function direct(topIdx, botIdx) {
        const data = dataAt(idx, topIdx);
        recordSegmentHitbox(
          pathD(topX[topIdx], topY, botX[botIdx], botY),
          data,
          solidBoundaryNode(partName, idx, topIdx),
          solidBoundaryNode(partName, idx + 1, botIdx),
        );
      }

      function directThroughVirtual(topIdx, botIdx, virtualX, virtualY, virtualKey) {
        const incomingData = dataAt(idx, topIdx);
        const outgoingData = dataAt(idx + 1, botIdx);
        recordSegmentHitbox(
          pathD(topX[topIdx], topY, virtualX, virtualY),
          incomingData,
          solidBoundaryNode(partName, idx, topIdx),
          virtualKey,
        );
        recordSegmentHitbox(
          pathD(virtualX, virtualY, botX[botIdx], botY),
          outgoingData,
          virtualKey,
          solidBoundaryNode(partName, idx + 1, botIdx),
        );
      }

      if (stripMove.type === "tetra") {
        for (let edgeIdx = 0; edgeIdx < q; edgeIdx += 1) direct(edgeIdx, edgeIdx);
        direct(q, q + 1);
        direct(q + 1, q);
        for (let edgeIdx = q + 2; edgeIdx < before.length; edgeIdx += 1) direct(edgeIdx, edgeIdx);
      } else if (stripMove.type === "hexa") {
        for (let edgeIdx = 0; edgeIdx < q; edgeIdx += 1) direct(edgeIdx, edgeIdx);
        const vertexX = (topX[q] + topX[q + 1] + topX[q + 2]) / 3;
        const vertexY = (topY + botY) / 2;
        for (let local = 0; local < 3; local += 1) {
          recordSegmentHitbox(
            pathD(topX[q + local], topY, vertexX, vertexY),
            dataAt(idx, q + local),
            solidBoundaryNode(partName, idx, q + local),
            null,
          );
          recordSegmentHitbox(
            pathD(vertexX, vertexY, botX[q + local], botY),
            dataAt(idx + 1, q + local),
            null,
            solidBoundaryNode(partName, idx + 1, q + local),
          );
        }
        for (let edgeIdx = q + 3; edgeIdx < before.length; edgeIdx += 1) direct(edgeIdx, edgeIdx);
      } else if (stripMove.type === "octa") {
        for (let edgeIdx = 0; edgeIdx < q; edgeIdx += 1) direct(edgeIdx, edgeIdx);
        const vertexX = (topX[q] + topX[q + 1] + topX[q + 2] + topX[q + 3]) / 4;
        const vertexY = (topY + botY) / 2;
        for (let local = 0; local < 4; local += 1) {
          recordSegmentHitbox(
            pathD(topX[q + local], topY, vertexX, vertexY),
            dataAt(idx, q + local),
            solidBoundaryNode(partName, idx, q + local),
            null,
          );
          recordSegmentHitbox(
            pathD(vertexX, vertexY, botX[q + local], botY),
            dataAt(idx + 1, q + local),
            null,
            solidBoundaryNode(partName, idx + 1, q + local),
          );
        }
        for (let edgeIdx = q + 4; edgeIdx < before.length; edgeIdx += 1) direct(edgeIdx, edgeIdx);
      } else if (stripMove.type === "tri") {
        for (let edgeIdx = 0; edgeIdx < q; edgeIdx += 1) direct(edgeIdx, edgeIdx);
        const vertexX = (topX[q] + topX[q + 1] + botX[q]) / 3;
        const vertexY = (topY + botY) / 2;
        const nwData = dataAt(idx, q);
        const neData = dataAt(idx, q + 1);
        const sData = dataAt(idx + 1, q);
        recordSegmentHitbox(
          pathD(topX[q], topY, vertexX, vertexY),
          nwData,
          solidBoundaryNode(partName, idx, q),
          null,
          nwData.localName,
          (topX[q] + vertexX) / 2 - 8,
          (topY + vertexY) / 2 - 8,
        );
        recordSegmentHitbox(
          pathD(topX[q + 1], topY, vertexX, vertexY),
          neData,
          solidBoundaryNode(partName, idx, q + 1),
          null,
          neData.localName,
          (topX[q + 1] + vertexX) / 2 + 8,
          (topY + vertexY) / 2 - 8,
        );
        recordSegmentHitbox(
          pathD(vertexX, vertexY, botX[q], botY),
          sData,
          null,
          solidBoundaryNode(partName, idx + 1, q),
          sData.localName,
          (vertexX + botX[q]) / 2 + 12,
          (vertexY + botY) / 2 + 10,
        );
        for (let edgeIdx = q + 2; edgeIdx < before.length; edgeIdx += 1) {
          const virtualX = (topX[edgeIdx] + botX[edgeIdx - 1]) / 2;
          directThroughVirtual(
            edgeIdx,
            edgeIdx - 1,
            virtualX,
            vertexY,
            `${partName}:virtual:${idx}:${edgeIdx}`,
          );
        }
      }
    });
  }

  addClickableSegments("top", top, top.moves, topBoundaryYs, topEdgeData);
  addClickableSegments("bottom", weave, weave.moves, bottomBoundaryYs, edgeData);
  appendSolidEdgeGroups();

  (trace.bottomWeave.clusterValues ?? []).forEach((clusterValue) => {
    const idx = clusterValue.triMoveIndex;
    const stripMove = weave.moves[idx];
    if (!stripMove || stripMove.type !== "tri") return;
    const before = weave.words[idx];
    const after = weave.words[idx + 1];
    const rowTopY = bottomBoundaryYs[idx];
    const rowBotY = bottomBoundaryYs[idx + 1];
    const topX = rowXPositions(before.length, center, spacing);
    const botX = rowXPositions(after.length, center, spacing);
    const q = stripMove.pos;
    const vertexX = (topX[q] + topX[q + 1] + botX[q]) / 3;
    const vertexY = (rowTopY + rowBotY) / 2;
    const ray = rayByLabel.get(clusterValue.label);
    if (ray) {
      const virtualXs = (ray.crossings ?? []).map((crossing) => {
        const topIdx = stripMove.pos + 1 + crossing.virtualIndex;
        const botIdx = topIdx - 1;
        return (topX[topIdx] + botX[botIdx]) / 2;
      });
      const segmentXs = [vertexX, ...virtualXs, width - 42];
      for (let segIdx = 0; segIdx < segmentXs.length - 1; segIdx += 1) {
        const data = dashedSegmentData(ray, segIdx);
        const node = svgEl("line");
        const startGap = segIdx === 0 ? 8 : 6;
        const endGap = segIdx === segmentXs.length - 2 ? 0 : 6;
        const [x1, x2] = insetHorizontalSegment(segmentXs[segIdx], segmentXs[segIdx + 1], startGap, endGap);
        node.setAttribute("x1", String(x1));
        node.setAttribute("y1", String(vertexY));
        node.setAttribute("x2", String(x2));
        node.setAttribute("y2", String(vertexY));
        node.setAttribute("class", "dashed-edge-node");
        node.setAttribute("tabindex", "0");
        node.setAttribute("role", "button");
        node.setAttribute("aria-label", `show dashed matrix Y_${segIdx} for trivalent vertex ${clusterIndexText(clusterValue.label)}`);
        node.dataset.edgeKey = data.key;
        node.dataset.relatedCluster = clusterValue.label;
        node.addEventListener("click", () => selectItem(data));
        node.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectItem(data);
          }
        });
        svg.appendChild(node);
        const labelNode = appendText(svg, (segmentXs[segIdx] + segmentXs[segIdx + 1]) / 2, vertexY - 7, `Y_${segIdx}`, "dashed-matrix-label selection-cluster-label");
        labelNode.dataset.relatedCluster = clusterValue.label;
      }
      (ray.crossings ?? []).forEach((_, crossingIdx) => {
        const node = svgEl("circle");
        node.setAttribute("cx", String(virtualXs[crossingIdx]));
        node.setAttribute("cy", String(vertexY));
        node.setAttribute("r", "3.8");
        node.setAttribute("class", "virtual-vertex-marker");
        node.dataset.relatedCluster = clusterValue.label;
        node.setAttribute("aria-hidden", "true");
        svg.appendChild(node);
      });
    }
    const data = clusterData(clusterValue.label);
    const node = svgEl("circle");
    node.setAttribute("cx", String(vertexX));
    node.setAttribute("cy", String(vertexY));
    node.setAttribute("r", "6.8");
    node.setAttribute("class", "cluster-vertex-node");
    node.setAttribute("tabindex", "0");
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", `show cluster variable ${clusterVariableText(clusterValue.label)}`);
    node.dataset.edgeKey = data.key;
    node.dataset.cluster = clusterValue.label;
    node.dataset.relatedCluster = clusterValue.label;
    node.addEventListener("click", () => selectItem(data, { focusCycle: cycleOverlayAvailable }));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
          selectItem(data, { focusCycle: cycleOverlayAvailable });
      }
    });
    svg.appendChild(node);
    const labelNode = appendWeaveVertexBadge(svg, vertexX + 15, vertexY - 13, clusterValue.label, "cluster-vertex-node-label");
    labelNode.dataset.relatedCluster = clusterValue.label;
  });

  function lerpPoint(start, end, amount) {
    return {
      x: start.x + (end.x - start.x) * amount,
      y: start.y + (end.y - start.y) * amount,
    };
  }

  function branchAnchor(centerPoint, outerPoint, amount = 0.92) {
    return lerpPoint(centerPoint, outerPoint, amount);
  }

  function chooseCycleBranches(branches, fallback, centerPoint) {
    const sourceBranches = branches.filter((branch) => branch.sourceWeight > 0);
    const targetBranches = branches.filter((branch) => branch.targetWeight > 0);
    if (sourceBranches.length === 0 || targetBranches.length === 0) return fallback;

    let best = null;
    sourceBranches.forEach((source) => {
      targetBranches.forEach((target) => {
        const distance = Math.hypot(target.point.x - source.point.x, target.point.y - source.point.y);
        const sameBranchPenalty = source.name === target.name ? 80 : 0;
        const score = distance * 3
          + (source.sourceWeight + target.targetWeight) * 12
          - sameBranchPenalty;
        if (best === null || score > best.score) best = { source, target, score, distance };
      });
    });

    if (best === null || best.distance < 24) return fallback;
    return {
      start: best.source.point,
      end: best.target.point,
      sourceName: best.source.name,
      targetName: best.target.name,
    };
  }

  function localArrowPath(start, end, center, bend = 26) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    const towardCenter = Math.sign((center.x - midpoint.x) * nx + (center.y - midpoint.y) * ny) || 1;
    const qx = center.x - towardCenter * nx * bend;
    const qy = center.y - towardCenter * ny * bend;
    return `M ${start.x} ${start.y} Q ${qx} ${qy} ${end.x} ${end.y}`;
  }

  function evidenceGeometry(entry, arrow) {
    const sourceCycle = cycleByLabel.get(arrow.source);
    const targetCycle = cycleByLabel.get(arrow.target);
    if (entry.kind === "bottom-boundary") {
      const y = bottomBoundaryYs[bottomBoundaryYs.length - 1] - 10;
      const word = weave.words[weave.words.length - 1] ?? [];
      const xs = rowXPositions(word.length, center, spacing);
      const sourceRow = sourceCycle?.cycleRows[sourceCycle.cycleRows.length - 1] ?? [];
      const targetRow = targetCycle?.cycleRows[targetCycle.cycleRows.length - 1] ?? [];
      const activeXs = xs.filter((_, idx) => (sourceRow[idx] ?? 0) > 0 || (targetRow[idx] ?? 0) > 0);
      const midX = activeXs.length === 0
        ? width - 44
        : (Math.min(...activeXs) + Math.max(...activeXs)) / 2;
      const fallback = {
        start: { x: midX - 34, y },
        end: { x: midX + 34, y },
      };
      const branches = xs.map((x, idx) => ({
        name: `b${idx}`,
        point: { x, y },
        sourceWeight: sourceRow[idx] ?? 0,
        targetWeight: targetRow[idx] ?? 0,
      }));
      return {
        ...chooseCycleBranches(branches, fallback, { x: midX, y }),
        center: { x: midX, y },
        bend: 26,
        label: "∂",
      };
    }
    const move = weave.moves[entry.stripIdx];
    if (!move) return null;
    const topY = bottomBoundaryYs[entry.stripIdx];
    const botY = bottomBoundaryYs[entry.stripIdx + 1];
    const before = weave.words[entry.stripIdx] ?? [];
    const after = weave.words[entry.stripIdx + 1] ?? [];
    const topX = rowXPositions(before.length, center, spacing);
    const botX = rowXPositions(after.length, center, spacing);
    const p = entry.pos;
    if (move.type === "tri") {
      const vertex = {
        x: (topX[p] + topX[p + 1] + botX[p]) / 3,
        y: (topY + botY) / 2,
      };
      const fallback = {
        start: { x: vertex.x - 33, y: vertex.y - 24 },
        end: { x: vertex.x + 33, y: vertex.y + 24 },
      };
      const branches = [
        {
          name: "left",
          point: branchAnchor(vertex, { x: topX[p], y: topY }, 0.95),
          sourceWeight: sourceCycle?.cycleRows[entry.stripIdx]?.[p] ?? 0,
          targetWeight: targetCycle?.cycleRows[entry.stripIdx]?.[p] ?? 0,
        },
        {
          name: "down",
          point: branchAnchor(vertex, { x: botX[p], y: botY }, 0.95),
          sourceWeight: sourceCycle?.cycleRows[entry.stripIdx + 1]?.[p] ?? 0,
          targetWeight: targetCycle?.cycleRows[entry.stripIdx + 1]?.[p] ?? 0,
        },
        {
          name: "right",
          point: branchAnchor(vertex, { x: topX[p + 1], y: topY }, 0.95),
          sourceWeight: sourceCycle?.cycleRows[entry.stripIdx]?.[p + 1] ?? 0,
          targetWeight: targetCycle?.cycleRows[entry.stripIdx]?.[p + 1] ?? 0,
        },
      ];
      return {
        ...chooseCycleBranches(branches, fallback, vertex),
        center: vertex,
        bend: 38,
        label: "△",
      };
    }
    if (move.type === "hexa") {
      const topCenter = (topX[p] + topX[p + 1] + topX[p + 2]) / 3;
      const botCenter = (botX[p] + botX[p + 1] + botX[p + 2]) / 3;
      const midX = (topCenter + botCenter) / 2;
      const midY = (topY + botY) / 2;
      const vertex = { x: topCenter, y: midY };
      const fallback = {
        start: { x: midX - 38, y: midY - 25 },
        end: { x: midX + 38, y: midY + 25 },
      };
      const branches = [
        {
          name: "top-left",
          point: branchAnchor(vertex, { x: topX[p], y: topY }, 0.95),
          sourceWeight: sourceCycle?.cycleRows[entry.stripIdx]?.[p] ?? 0,
          targetWeight: targetCycle?.cycleRows[entry.stripIdx]?.[p] ?? 0,
        },
        {
          name: "top-middle",
          point: branchAnchor(vertex, { x: topX[p + 1], y: topY }, 0.95),
          sourceWeight: sourceCycle?.cycleRows[entry.stripIdx]?.[p + 1] ?? 0,
          targetWeight: targetCycle?.cycleRows[entry.stripIdx]?.[p + 1] ?? 0,
        },
        {
          name: "top-right",
          point: branchAnchor(vertex, { x: topX[p + 2], y: topY }, 0.95),
          sourceWeight: sourceCycle?.cycleRows[entry.stripIdx]?.[p + 2] ?? 0,
          targetWeight: targetCycle?.cycleRows[entry.stripIdx]?.[p + 2] ?? 0,
        },
        {
          name: "bottom-left",
          point: branchAnchor(vertex, { x: botX[p], y: botY }, 0.95),
          sourceWeight: sourceCycle?.cycleRows[entry.stripIdx + 1]?.[p] ?? 0,
          targetWeight: targetCycle?.cycleRows[entry.stripIdx + 1]?.[p] ?? 0,
        },
        {
          name: "bottom-middle",
          point: branchAnchor(vertex, { x: botX[p + 1], y: botY }, 0.95),
          sourceWeight: sourceCycle?.cycleRows[entry.stripIdx + 1]?.[p + 1] ?? 0,
          targetWeight: targetCycle?.cycleRows[entry.stripIdx + 1]?.[p + 1] ?? 0,
        },
        {
          name: "bottom-right",
          point: branchAnchor(vertex, { x: botX[p + 2], y: botY }, 0.95),
          sourceWeight: sourceCycle?.cycleRows[entry.stripIdx + 1]?.[p + 2] ?? 0,
          targetWeight: targetCycle?.cycleRows[entry.stripIdx + 1]?.[p + 2] ?? 0,
        },
      ];
      return {
        ...chooseCycleBranches(branches, fallback, vertex),
        center: { x: midX, y: midY },
        bend: 42,
        label: "H",
      };
    }
    return null;
  }

  if (intersectionEvidenceAvailable) (quiverData.arrows ?? []).forEach((arrow) => {
    const arrowKey = quiverArrowKey(arrow.source, arrow.target);
    (arrow.contributions ?? []).forEach((entry, contributionIdx) => {
      const geometry = evidenceGeometry(entry, arrow);
      if (!geometry) return;
      const group = svgEl("g");
      group.setAttribute("class", "quiver-evidence-marker");
      group.dataset.arrowKey = arrowKey;
      group.setAttribute("aria-hidden", "true");
      const offsetY = (contributionIdx % 3) * 13;
      const start = { x: geometry.start.x, y: geometry.start.y + offsetY };
      const end = { x: geometry.end.x, y: geometry.end.y + offsetY };
      const localCenter = { x: geometry.center.x, y: geometry.center.y + offsetY };
      const localPath = localArrowPath(start, end, localCenter, geometry.bend ?? 28);
      const arrowPath = svgEl("path");
      arrowPath.setAttribute("d", localPath);
      arrowPath.setAttribute("class", "quiver-evidence-arrow");
      arrowPath.setAttribute("marker-end", "url(#weave-evidence-arrowhead-black)");
      group.appendChild(arrowPath);
      svg.appendChild(group);
    });
  });

  figureWrap.appendChild(svg);
  panel.append(figureWrap, info);
  if (initialLabel && bottomByLabel.has(initialLabel)) {
    selectItem(clusterData(initialLabel), { notify: false, focusCycle: true });
  } else {
    renderEmptyInfo();
  }
  panel.selectCluster = (label, { focusCycle = false } = {}) => {
    if (label && bottomByLabel.has(label)) selectItem(clusterData(label), { notify: false, focusCycle });
    else clearViewerSelection({ notify: false });
  };
  panel.selectQuiverArrow = (arrow) => {
    if (!arrow) {
      clearViewerSelection({ notify: false });
      return;
    }
    selectedKey = null;
    selectedClusterLabel = null;
    selectedArrowKey = quiverArrowKey(arrow.source, arrow.target);
    primaryCycleLabel = null;
    focusedCycleLabels = new Set([arrow.source, arrow.target]);
    visibleEvidenceArrowKeys = new Set([selectedArrowKey]);
    svg.querySelectorAll(".edge-label-segment, .cluster-vertex-node, .dashed-edge-node").forEach((node) => {
      node.classList.remove("active");
    });
    panel.classList.add("has-selection");
    syncRelatedMarkers();
    renderQuiverArrowInfo(arrow);
  };
  panel.setCyclesVisible = (visible) => {
    cyclesVisible = visible;
    syncCycleDisplay();
    syncRelatedMarkers();
  };
  return panel;
}

function quiverWeightToText(weight) {
  return String(weight);
}

function negateQuiverWeight(weight) {
  const numeric = quiverWeightToNumber(weight);
  if (Math.abs(numeric) < 1e-9) return 0;
  if (typeof weight === "string" && weight.includes("/")) {
    return weight.startsWith("-") ? weight.slice(1) : `-${weight}`;
  }
  return -numeric;
}

function quiverWeightToNumber(weight) {
  if (typeof weight === "number") return weight;
  if (typeof weight === "string" && weight.includes("/")) {
    const [num, den] = weight.split("/").map(Number);
    return num / den;
  }
  return Number(weight);
}

function exchangeMatrixValueText(value) {
  const numeric = quiverWeightToNumber(value);
  if (!Number.isFinite(numeric) || Math.abs(numeric) < 1e-9) return "0";
  return String(value);
}

function renderExchangeMatrixTable(quiver) {
  const labels = quiver.labels ?? [];
  const columnLabels = quiver.columnLabels ?? labels;
  const scroll = el("div", "exchange-matrix-scroll");
  const table = el("table", "exchange-matrix-table");
  const thead = el("thead");
  const headRow = el("tr");
  headRow.appendChild(el("th", "exchange-matrix-corner", ""));
  columnLabels.forEach((label) => {
    headRow.appendChild(el("th", "", clusterIndexText(label)));
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  labels.forEach((rowLabel) => {
    const row = el("tr");
    row.appendChild(el("th", "", clusterIndexText(rowLabel)));
    columnLabels.forEach((colLabel) => {
      const raw = quiver.epsilon?.[rowLabel]?.[colLabel] ?? 0;
      const text = exchangeMatrixValueText(raw);
      const numeric = quiverWeightToNumber(raw);
      const cellClass = Math.abs(numeric) < 1e-9
        ? "exchange-matrix-zero"
        : numeric > 0
          ? "exchange-matrix-positive"
          : "exchange-matrix-negative";
      row.appendChild(el("td", cellClass, text));
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  return scroll;
}

function renderExchangeMatrixMeta(quiver) {
  if (quiver.ordinaryQuiver !== false) return null;
  const symmetrizer = quiver.symmetrizer ?? [];
  const meta = el("div", "exchange-matrix-caption exchange-matrix-meta");
  meta.appendChild(formulaSpan(`d=(${symmetrizer.join(",")})`));
  meta.append(" · skew-symmetrizable exchange data. Rows are all displayed vertices; columns are mutable vertices when the matrix is extended. Graph edge labels are valued weights d_source b_source,target; the table lists the matrix entries.");
  if (quiver.source) {
    meta.append(` Source: ${quiver.source}.`);
  }
  if (quiver.cycleOverlayAvailable === false) {
    meta.append(" Dual Lusztig-cycle intersection evidence is not drawn.");
  }
  return meta;
}

function renderExchangeMatrixToggle(quiver, label, options = {}) {
  const initiallyOpen = options.initiallyOpen ?? false;
  const block = el("div", "exchange-matrix-toggle-block");
  const button = el("button", "exchange-matrix-toggle", "Exchange matrix");
  button.type = "button";
  button.setAttribute("aria-expanded", String(initiallyOpen));
  button.classList.toggle("active", initiallyOpen);
  const panel = el("div", initiallyOpen ? "exchange-matrix-panel" : "exchange-matrix-panel hidden");
  const caption = el("div", "exchange-matrix-caption");
  caption.appendChild(formulaSpan(label));
  const meta = renderExchangeMatrixMeta(quiver);
  panel.append(caption);
  if (meta) panel.appendChild(meta);
  panel.appendChild(renderExchangeMatrixTable(quiver));
  button.addEventListener("click", () => {
    const open = panel.classList.toggle("hidden") === false;
    button.classList.toggle("active", open);
    button.setAttribute("aria-expanded", String(open));
    block.closest(".quiver-answer-panel")?.classList.toggle("matrix-open", open);
  });
  block.append(button, panel);
  return block;
}

function renderQuiverSvg(quiver, cycleColors, onSelect = null, onArrowSelect = null) {
  const labels = quiver.labels ?? [];
  if (labels.length === 0) return null;

  const width = 820;
  const height = Math.max(330, Math.min(560, 250 + labels.length * 16));
  const cx = width / 2;
  const cy = height / 2 + 8;
  const rx = Math.min(width * 0.36, 310);
  const ry = Math.min(height * 0.34, 190);
  const svg = svgEl("svg");
  svg.setAttribute("class", "quiver-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");

  const defs = svgEl("defs");
  quiverMarkerIdCounter += 1;
  const markerId = `quiver-arrowhead-${quiverMarkerIdCounter}`;
  const marker = svgEl("marker");
  marker.setAttribute("id", markerId);
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "8");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "4");
  marker.setAttribute("orient", "auto");
  const polygon = svgEl("polygon");
  polygon.setAttribute("points", "0 0, 10 4, 0 8");
  polygon.setAttribute("class", "quiver-arrowhead");
  marker.appendChild(polygon);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const background = svgEl("rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(width));
  background.setAttribute("height", String(height));
  background.setAttribute("fill", "white");
  svg.appendChild(background);

  const guide = svgEl("ellipse");
  guide.setAttribute("cx", String(cx));
  guide.setAttribute("cy", String(cy));
  guide.setAttribute("rx", String(rx));
  guide.setAttribute("ry", String(ry));
  guide.setAttribute("class", "quiver-guide");
  svg.appendChild(guide);

  const positions = new Map();
  labels.forEach((label, idx) => {
    const theta = labels.length === 1
      ? -Math.PI / 2
      : -Math.PI / 2 + (2 * Math.PI * idx) / labels.length;
    positions.set(label, {
      x: cx + rx * Math.cos(theta),
      y: cy + ry * Math.sin(theta),
      theta,
      idx,
    });
  });

  function offsetPoint(x, y, targetX, targetY, radius) {
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-9) return [x, y];
    return [x + (radius * dx) / dist, y + (radius * dy) / dist];
  }

  function quadMid(x1, y1, qx, qy, x2, y2) {
    return [
      0.25 * x1 + 0.5 * qx + 0.25 * x2,
      0.25 * y1 + 0.5 * qy + 0.25 * y2,
    ];
  }

  (quiver.arrows ?? []).forEach((arrow) => {
    if (arrow.source === arrow.target) return;
    const source = positions.get(arrow.source);
    const target = positions.get(arrow.target);
    if (!source || !target) return;

    const mx = (source.x + target.x) / 2;
    const my = (source.y + target.y) / 2;
    let vx = mx - cx;
    let vy = my - cy;
    let norm = Math.hypot(vx, vy);
    if (norm < 1e-9) {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      vx = -dy;
      vy = dx;
      norm = Math.hypot(vx, vy) || 1;
    }
    const indexGap = Math.min(
      Math.abs(target.idx - source.idx),
      labels.length - Math.abs(target.idx - source.idx),
    );
    const bulge = 54 + 14 * indexGap;
    const qx = mx + (bulge * vx) / norm;
    const qy = my + (bulge * vy) / norm;
    const [sx, sy] = offsetPoint(source.x, source.y, qx, qy, 18);
    const [tx, ty] = offsetPoint(target.x, target.y, qx, qy, 24);

    const path = svgEl("path");
    path.setAttribute("d", `M ${sx} ${sy} Q ${qx} ${qy} ${tx} ${ty}`);
    path.setAttribute("class", onArrowSelect ? "quiver-arrow selectable" : "quiver-arrow");
    path.dataset.source = arrow.source;
    path.dataset.target = arrow.target;
    path.dataset.arrowKey = `${arrow.source}->${arrow.target}`;
    path.setAttribute("marker-end", `url(#${markerId})`);
    svg.appendChild(path);

    if (onArrowSelect) {
      const hitbox = svgEl("path");
      hitbox.setAttribute("d", `M ${sx} ${sy} Q ${qx} ${qy} ${tx} ${ty}`);
      hitbox.setAttribute("class", "quiver-arrow-hitbox");
      hitbox.dataset.source = arrow.source;
      hitbox.dataset.target = arrow.target;
      hitbox.dataset.arrowKey = `${arrow.source}->${arrow.target}`;
      hitbox.setAttribute("role", "button");
      hitbox.setAttribute("tabindex", "0");
      hitbox.setAttribute("aria-label", `show quiver arrow ${clusterIndexText(arrow.source)} to ${clusterIndexText(arrow.target)}`);
      const setArrowHover = (active) => {
        path.classList.toggle("hover", active);
      };
      hitbox.addEventListener("mouseenter", () => setArrowHover(true));
      hitbox.addEventListener("mouseleave", () => setArrowHover(false));
      hitbox.addEventListener("focus", () => setArrowHover(true));
      hitbox.addEventListener("blur", () => setArrowHover(false));
      hitbox.addEventListener("click", () => onArrowSelect(arrow));
      hitbox.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onArrowSelect(arrow);
        }
      });
      svg.appendChild(hitbox);
    }

    if (quiverWeightToNumber(arrow.weight) !== 1) {
      const [lx, ly] = quadMid(sx, sy, qx, qy, tx, ty);
      const box = svgEl("rect");
      box.setAttribute("x", String(lx - 11));
      box.setAttribute("y", String(ly - 14));
      box.setAttribute("width", "22");
      box.setAttribute("height", "16");
      box.setAttribute("rx", "5");
      box.setAttribute("class", "quiver-weight-box");
      svg.appendChild(box);
      appendText(svg, lx, ly - 2, quiverWeightToText(arrow.weight), "quiver-weight-label");
    }
  });

  const frozen = new Set(quiver.frozen ?? []);
  labels.forEach((label) => {
    const position = positions.get(label);
    const color = cycleColors.get(label) ?? "#3b82f6";
    const group = svgEl("g");
    group.setAttribute("class", onSelect ? "quiver-node-group selectable" : "quiver-node-group");
    group.dataset.cluster = label;
    if (onSelect) {
      group.setAttribute("role", "button");
      group.setAttribute("tabindex", "0");
      group.setAttribute("aria-label", `select trivalent vertex ${clusterIndexText(label)}`);
      group.addEventListener("click", () => onSelect(label));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(label);
        }
      });
    }
    if (frozen.has(label)) {
      const halo = svgEl("rect");
      halo.setAttribute("x", String(position.x - 20));
      halo.setAttribute("y", String(position.y - 20));
      halo.setAttribute("width", "40");
      halo.setAttribute("height", "40");
      halo.setAttribute("rx", "7");
      halo.setAttribute("class", "quiver-node-halo frozen");
      group.appendChild(halo);
      const node = svgEl("rect");
      node.setAttribute("x", String(position.x - 15));
      node.setAttribute("y", String(position.y - 15));
      node.setAttribute("width", "30");
      node.setAttribute("height", "30");
      node.setAttribute("rx", "5");
      node.setAttribute("fill", color);
      node.setAttribute("class", "quiver-node frozen");
      group.appendChild(node);
    } else {
      const halo = svgEl("circle");
      halo.setAttribute("cx", String(position.x));
      halo.setAttribute("cy", String(position.y));
      halo.setAttribute("r", "21");
      halo.setAttribute("class", "quiver-node-halo mutable");
      group.appendChild(halo);
      const node = svgEl("circle");
      node.setAttribute("cx", String(position.x));
      node.setAttribute("cy", String(position.y));
      node.setAttribute("r", "15");
      node.setAttribute("fill", color);
      node.setAttribute("class", "quiver-node mutable");
      group.appendChild(node);
    }

    appendText(group, position.x, position.y + 4, clusterIndexText(label), "quiver-node-label");
    svg.appendChild(group);
  });

  return svg;
}

export function renderQuiverAnswerPanel(weave, cycleColors, onSelect = null, onArrowSelect = null, options = {}) {
  const quiver = weave.quiverData;
  const ordinary = quiver?.ordinaryQuiver !== false;
  const quiverLabel = options.quiverLabel ?? (ordinary ? "Q(𝒲_{Δ̲}(ℭ))" : "ε(𝒲_{Δ̲}(ℭ))");
  const matrixLabel = options.matrixLabel ?? (ordinary ? "B(Q(𝒲_{Δ̲}(ℭ)))" : "ε(𝒲_{Δ̲}(ℭ))");
  const canShowIntersectionEvidence = quiver?.intersectionEvidenceAvailable !== false;
  const panel = el("div", "answer-panel quiver-answer-panel");
  const header = el("div", "answer-panel-header");
  header.appendChild(el("h3", "", ordinary ? "Quiver" : "Valued exchange graph"));
  const headerRight = el("div", "answer-panel-actions");
  headerRight.appendChild(mathText(quiverLabel));
  header.appendChild(headerRight);
  panel.appendChild(header);

  if (!quiver || (quiver.labels ?? []).length === 0) {
    panel.appendChild(el("p", "small-note", ordinary
      ? "No trivalent vertex occurs, so the quiver is empty."
      : "No trivalent vertex occurs, so the exchange graph is empty."));
    return panel;
  }
  const scroller = el("div", "quiver-scroll");
  scroller.appendChild(renderQuiverSvg(
    quiver,
    cycleColors,
    onSelect,
    canShowIntersectionEvidence ? onArrowSelect : null,
  ));
  panel.appendChild(scroller);
  panel.appendChild(renderExchangeMatrixToggle(quiver, matrixLabel, {
    initiallyOpen: !ordinary,
  }));
  panel.classList.toggle("matrix-open", !ordinary);
  return panel;
}

function matrixEntries(matrix) {
  const out = [];
  matrix.forEach((row, rowIdx) => {
    row.forEach((value, colIdx) => {
      const diagonalIdentity = rowIdx === colIdx && value === "1";
      if (value !== "0" && !diagonalIdentity) {
        out.push({ row: rowIdx + 1, col: colIdx + 1, value });
      }
    });
  });
  return out;
}

function renderMatrixEntries(matrix, mapValue = (value) => value) {
  const entries = matrixEntries(matrix);
  if (entries.length === 0) return el("span", "cycle-zero", "I");
  const wrap = el("div", "matrix-entry-list");
  entries.forEach((entry) => {
    const item = el("div", "matrix-entry-item");
    item.appendChild(el("span", "matrix-position", `(${entry.row},${entry.col})`));
    const valueNode = el("code");
    valueNode.appendChild(formulaSpan(mapValue(entry.value)));
    item.appendChild(valueNode);
    wrap.appendChild(item);
  });
  return wrap;
}

function renderBottomWeaveSvg(weave, compact = false, options = {}) {
  const {
    showInitialTopLabels = true,
    showBoundaryWordLabels = true,
    topBoundarySummary = null,
  } = options;
  const maxRowLength = Math.max(...weave.words.map((row) => row.length), 1);
  const spacing = compact ? 30 : 38;
  const rowHeight = compact ? 46 : 62;
  const marginX = compact ? 54 : 64;
  const summaryHeight = topBoundarySummary ? (compact ? 116 : 126) : 0;
  const marginTop = (compact ? 30 : 34) + summaryHeight;
  const marginBottom = compact ? 30 : 34;
  const width = Math.max(compact ? 640 : 720, marginX * 2 + maxRowLength * spacing + 120);
  const height = Math.max(compact ? 130 : 150, marginTop + marginBottom + Math.max(weave.moves.length, 1) * rowHeight);
  const center = width / 2;
  const svg = svgEl("svg");
  svg.setAttribute("class", compact ? "weave-svg bottom-weave-svg compact" : "weave-svg bottom-weave-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");

  const background = svgEl("rect");
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(width));
  background.setAttribute("height", String(height));
  background.setAttribute("fill", "white");
  svg.appendChild(background);

  function drawTopBoundarySummary() {
    if (!topBoundarySummary) return;
    if (topBoundarySummary.title) {
      appendText(svg, 18, 25, topBoundarySummary.title, "weave-boundary-title");
    }
    const topWord = weave.words[0] ?? [];
    const xs = rowXPositions(topWord.length, center, spacing);
    if (topBoundarySummary.boundary) {
      const labelX = xs[0] ? xs[0] - 74 : 18;
      appendText(svg, labelX, marginTop - 22, topBoundarySummary.boundary, "weave-boundary-equation");
    }
    let cursor = 0;
    topBoundarySummary.groups.forEach((group) => {
      const entries = group.entries ?? [];
      if (entries.length === 0) return;
      const first = cursor;
      const last = cursor + entries.length - 1;
      const x1 = xs[first] - 13;
      const x2 = xs[last] + 13;
      const groupCenter = (xs[first] + xs[last]) / 2;
      const labelLines = group.label.includes(", ")
        ? group.label.split(", ").map((line) => line.trim())
        : [group.label];
      const labelStartY = labelLines.length === 1 ? marginTop - 62 : marginTop - 72;
      labelLines.forEach((line, lineIdx) => {
        appendText(svg, groupCenter, labelStartY + 11 * lineIdx, line, "weave-boundary-group-label");
      });
      const bracket = svgEl("path");
      bracket.setAttribute("d", `M ${x1} ${marginTop - 50} L ${x1} ${marginTop - 44} L ${x2} ${marginTop - 44} L ${x2} ${marginTop - 50}`);
      bracket.setAttribute("class", "weave-boundary-bracket");
      svg.appendChild(bracket);
      entries.forEach((entry, idx) => {
        const chipX = xs[cursor + idx];
        const rect = svgEl("rect");
        rect.setAttribute("x", String(chipX - 12));
        rect.setAttribute("y", String(marginTop - 36));
        rect.setAttribute("width", "24");
        rect.setAttribute("height", "20");
        rect.setAttribute("rx", "4");
        rect.setAttribute("class", `weave-boundary-chip ${group.kind}`);
        svg.appendChild(rect);
        appendText(svg, chipX, marginTop - 22, String(entry.h), "weave-boundary-chip-text");
      });
      cursor += entries.length;
    });
  }

  drawTopBoundarySummary();

  if (weave.moves.length === 0) {
    const xs = rowXPositions(weave.words[0].length, center, spacing);
    if (showBoundaryWordLabels) {
      weave.words[0].forEach((generator, idx) => {
        appendText(svg, xs[idx], marginTop + 40, String(generator));
      });
    }
  }

  weave.moves.forEach((move, stripIdx) => {
    const before = weave.words[stripIdx];
    const after = weave.words[stripIdx + 1];
    const topY = marginTop + stripIdx * rowHeight;
    const botY = topY + rowHeight;
    drawStripGeometry(svg, {
      before,
      after,
      move,
      triInfo: triInfoForStrip(weave, stripIdx),
      width,
      topY,
      botY,
      center,
      spacing,
      showBoundaryLabels: false,
    });

    if (stripIdx === 0 && showInitialTopLabels) {
      const topX = rowXPositions(before.length, center, spacing);
      before.forEach((generator, idx) => appendText(svg, topX[idx], topY - 9, String(generator)));
    }
    if (showBoundaryWordLabels) {
      const botX = rowXPositions(after.length, center, spacing);
      after.forEach((generator, idx) => appendText(svg, botX[idx], botY + 16, String(generator), "weave-bottom-label"));
    }

  });

  return svg;
}

function renderFullWeave(trace) {
  const body = el("div", "weave-block whole-mode-view whole-result-view");
  const weaveTitle = trace.weaveTitle ?? "𝒲_{Δ̲}(ℭ)";
  const cycleColors = new Map(trace.bottomWeave.lusztigCycles.map((cycle, idx) => [cycle.label, cycleColor(idx)]));
  const clusterValues = clusterValuesForDisplay(trace);
  const clusterLabels = new Set(clusterValues.map((value) => value.label));
  const quiverArrowKey = (source, target) => `${source}->${target}`;
  const quiverArrows = trace.bottomWeave.quiverData?.arrows ?? [];
  const cycleOverlayAvailable = trace.bottomWeave.quiverData?.cycleOverlayAvailable !== false;
  const intersectionEvidenceAvailable = trace.bottomWeave.quiverData?.intersectionEvidenceAvailable !== false;
  const arrowByKey = new Map(quiverArrows.map((arrow) => [quiverArrowKey(arrow.source, arrow.target), arrow]));
  let selectedCluster = null;
  let selectedClusterFocus = false;
  let selectedArrow = null;
  try {
    const params = new URLSearchParams(window.location.search);
    const requestedCluster = params.get("cluster");
    const requestedArrow = params.get("arrow");
    if (clusterLabels.has(requestedCluster)) {
      selectedCluster = requestedCluster;
      selectedClusterFocus = cycleOverlayAvailable;
    }
    else if (intersectionEvidenceAvailable && arrowByKey.has(requestedArrow)) selectedArrow = arrowByKey.get(requestedArrow);
  } catch {
    selectedCluster = null;
    selectedClusterFocus = false;
    selectedArrow = null;
  }

  const toolbar = el("div", "full-weave-toolbar");
  const sizeControls = el("div", "full-weave-control-group");
  let compactMode = true;
  let cyclesVisible = false;
  let interactiveViewer = null;

  function syncCycleVisibility() {
    if (!cycleOverlayAvailable) return;
    interactiveViewer?.setCyclesVisible?.(cyclesVisible);
    cycleToggle?.classList.toggle("active", cyclesVisible);
  }

  [
    ["fit", "Fit"],
    ["full", "Full"],
  ].forEach(([mode, label], idx) => {
    const button = el("button", idx === 0 ? "weave-size-button active" : "weave-size-button", label);
    button.type = "button";
    button.addEventListener("click", () => {
      compactMode = mode === "fit";
      interactiveViewer?.classList.toggle("full-mode", !compactMode);
      sizeControls.querySelectorAll(".weave-size-button").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      syncCycleVisibility();
    });
    sizeControls.appendChild(button);
  });

  let cycleToggle = null;
  if (cycleOverlayAvailable) {
    cycleToggle = el("button", "weave-toggle-button", "Lusztig cycles");
    cycleToggle.type = "button";
    cycleToggle.addEventListener("click", () => {
      cyclesVisible = !cyclesVisible;
      syncCycleVisibility();
    });
    toolbar.append(sizeControls, cycleToggle);
  } else {
    toolbar.appendChild(sizeControls);
  }

  interactiveViewer = renderInteractiveWeaveViewer(trace, {
    initialLabel: selectedCluster,
    cycleColors,
    onSelectionChange: (data) => {
      selectedCluster = data?.kind === "cluster" ? data.label : null;
      selectedClusterFocus = false;
      selectedArrow = null;
      syncClusterSelection({ updateViewer: false });
      syncWholeUrl();
    },
  });
  interactiveViewer.classList.add("main-interactive-weave");

  const resultView = body;

  function syncWholeUrl() {
    if (!window.history?.replaceState) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", "whole");
    url.searchParams.delete("detail");
    if (selectedCluster !== null) {
      url.searchParams.set("cluster", selectedCluster);
      url.searchParams.delete("arrow");
    } else if (selectedArrow !== null) {
      url.searchParams.delete("cluster");
      url.searchParams.set("arrow", quiverArrowKey(selectedArrow.source, selectedArrow.target));
    } else {
      url.searchParams.delete("cluster");
      url.searchParams.delete("arrow");
    }
    window.history.replaceState(null, "", url);
  }

  function syncClusterSelection({ scroll = false, updateViewer = true } = {}) {
    resultView.classList.toggle("has-cluster-selection", selectedCluster !== null);
    resultView.classList.toggle("has-quiver-arrow-selection", selectedArrow !== null);
    resultView.querySelectorAll("[data-cluster]").forEach((node) => {
      node.classList.toggle("active", selectedCluster !== null && node.dataset.cluster === selectedCluster);
      node.classList.toggle("paired", selectedArrow !== null
        && (node.dataset.cluster === selectedArrow.source || node.dataset.cluster === selectedArrow.target));
    });
    resultView.querySelectorAll(".quiver-arrow").forEach((node) => {
      const exactArrow = selectedArrow !== null
        && node.dataset.arrowKey === quiverArrowKey(selectedArrow.source, selectedArrow.target);
      const incident = selectedCluster !== null
        && (node.dataset.source === selectedCluster || node.dataset.target === selectedCluster);
      node.classList.toggle("active", exactArrow || incident);
      node.classList.toggle("dimmed", (selectedCluster !== null && !incident) || (selectedArrow !== null && !exactArrow));
    });
    resultView.querySelectorAll(".cluster-answer-item").forEach((node) => {
      if (scroll && node.dataset.cluster === selectedCluster) {
        node.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
    if (updateViewer) {
      if (selectedArrow !== null) interactiveViewer?.selectQuiverArrow?.(selectedArrow);
      else interactiveViewer?.selectCluster?.(selectedCluster, { focusCycle: selectedClusterFocus });
    }
    syncCycleVisibility();
  }
  function selectClusterFromQuiver(label) {
    const next = selectedCluster === label ? null : label;
    selectedCluster = next;
    selectedClusterFocus = next !== null && cycleOverlayAvailable;
    selectedArrow = null;
    syncClusterSelection({ scroll: next !== null });
    syncWholeUrl();
  }
  function selectClusterFromList(label) {
    const next = selectedCluster === label ? null : label;
    selectedCluster = next;
    selectedClusterFocus = next !== null && cycleOverlayAvailable;
    selectedArrow = null;
    syncClusterSelection({ scroll: next !== null });
    syncWholeUrl();
  }
  function selectQuiverArrow(arrow) {
    const currentKey = selectedArrow === null ? null : quiverArrowKey(selectedArrow.source, selectedArrow.target);
    const nextKey = quiverArrowKey(arrow.source, arrow.target);
    selectedArrow = currentKey === nextKey ? null : arrow;
    selectedCluster = null;
    selectedClusterFocus = false;
    syncClusterSelection();
    syncWholeUrl();
  }
  function clearClusterSelection() {
    selectedCluster = null;
    selectedClusterFocus = false;
    selectedArrow = null;
    syncClusterSelection();
    syncWholeUrl();
  }
  const quiverPanel = renderQuiverAnswerPanel(
    trace.bottomWeave,
    cycleColors,
    selectClusterFromQuiver,
    intersectionEvidenceAvailable ? selectQuiverArrow : null,
    {
      quiverLabel: trace.quiverLabel,
      matrixLabel: trace.matrixLabel,
    },
  );
  const clusterPanel = renderClusterVariableAnswerPanel(trace, cycleColors, selectClusterFromList, clearClusterSelection, {
    weaveLabel: weaveTitle,
    variableHeader: trace.variableHeader,
  });

  const weaveStage = el("div", "weave-stage-panel");
  weaveStage.append(toolbar, interactiveViewer);
  body.append(weaveStage, quiverPanel, clusterPanel);
  syncClusterSelection();
  return renderCard(
    weaveTitle,
    body,
    trace.weaveSubtitle ?? "𝒲_{Δ̲}(ℭ) is the vertical concatenation of 𝒲^T_{Δ̲}(ℭ) and 𝒲^B_{Δ̲}(ℭ) along i_{Δ̲}(ℭ).",
  );
}

function renderOpenRichardsonSummary(trace) {
  const ric = trace.openRichardson;
  const body = el("div", "double-string-block");
  const panel = el("div", "string-construction-panel");
  const header = el("div", "string-panel-header");
  header.appendChild(el("span", "string-panel-title", "Open Richardson data"));
  panel.appendChild(header);

  const facts = el("div", "ric-data-grid");
  [
    ["type", `A_${trace.rank}`],
    ["v", ric.vWord.length === 0 ? "e" : ric.vWord.join(" ")],
    ["w", ric.wWord.join(" ")],
    ["v^c", ric.vcWord.join(" ")],
    ["r", String(ric.freeWord.length)],
    ["P_Ric", `{${ric.plusPositions.join(", ")}}`],
    ["i_Ric", ric.freeWord.join(" ")],
  ].forEach(([label, value]) => {
    const row = el("div", "ric-data-row");
    row.appendChild(el("span", "ric-data-key", label));
    row.appendChild(formulaSpan(value, "formula ric-data-value"));
    facts.appendChild(row);
  });
  panel.appendChild(facts);

  const skeleton = el("div", "double-string-expression");
  skeleton.appendChild(formulaSpan("s_Ric^L = "));
  const chips = el("div", "double-string-chips");
  ric.skeletonEntries.forEach((entry) => {
    const chip = el("span", `double-string-chip ${entry.plus ? "prefix" : "chain"}`);
    chip.textContent = formatDoubleStringEntry(entry);
    chip.title = entry.source === "vc"
      ? `from v^c, position ${entry.t}`
      : `from w, position ${entry.t}${entry.plus ? " in P_Ric" : " not in P_Ric"}`;
    chips.appendChild(chip);
  });
  skeleton.appendChild(chips);
  panel.appendChild(skeleton);

  const note = el("p", "small-note");
  note.append("This is the CGGLS-Ménard left Richardson double string after deleting the terminal ");
  note.appendChild(formulaSpan("v^*"));
  note.append(" block. The non-+ entries in the ");
  note.appendChild(formulaSpan("w"));
  note.append(" block form ");
  note.appendChild(formulaSpan("i_Ric"));
  note.append("; the LR sequence below is only the experimental analogue on this non-+ word.");
  panel.appendChild(note);

  body.append(panel, renderOpenRichardsonIBoxAnalogue(trace));
  return renderCard("ℭ_Ric", body);
}

function renderOpenRichardsonIBoxAnalogue(trace) {
  const ric = trace.openRichardson;
  const freeEntries = ric.candidateDoubleString.filter((entry) => entry.source === "free");
  const freeByIndex = new Map(freeEntries.map((entry) => [entry.freeIndex, entry]));
  function mappedBoxText(box) {
    const left = freeByIndex.get(box[0])?.wPosition ?? box[0];
    const right = freeByIndex.get(box[1])?.wPosition ?? box[1];
    return `[${left},${right}] in w`;
  }

  const section = el("div", "answer-panel admissible-chain-panel open-richardson-ibox-section");
  const header = el("div", "answer-panel-header");
  header.appendChild(el("h3", "", "Admissible Chain"));
  section.appendChild(header);

  const note = el("p", "small-note");
  note.appendChild(formulaSpan(`c=${trace.c}`));
  note.append(", ");
  note.appendChild(formulaSpan(`LR=(${trace.lr.join(", ")})`));
  note.append(". The non-+ positions ");
  note.appendChild(formulaSpan(`M_Ric={${freeEntries.map((entry) => entry.wPosition).join(", ")}}`));
  note.append(" define the word ");
  note.appendChild(formulaSpan(`i_Ric=(${ric.freeWord.join(", ")})`));
  note.append("; the same LR rule gives the boxes of ");
  note.appendChild(formulaSpan("ℭ_Ric"));
  note.append(".");
  section.appendChild(note);

  const body = el("div", "admissible-chain-body");

  const envelopeBlock = el("div", "chain-section");
  envelopeBlock.appendChild(el("span", "chain-section-title", "Envelopes"));
  const wrap = el("div", "timeline");
  wrap.style.setProperty("--timeline-cols", String(trace.u.length));
  const headerRow = el("div", "timeline-row timeline-header");
  headerRow.appendChild(el("div", "timeline-label", ""));
  trace.u.forEach((color, idx) => {
    const cell = el("div", "timeline-cell header-cell", String(idx + 1));
    cell.title = `position ${idx + 1} in i_Ric, w-position ${freeByIndex.get(idx + 1)?.wPosition ?? idx + 1}, color ${color}`;
    headerRow.appendChild(cell);
  });
  wrap.appendChild(headerRow);
  trace.chain.rows.forEach((row) => {
    const line = el("div", "timeline-row chain-selectable");
    line.dataset.chainT = String(row.t);
    line.appendChild(el("div", "timeline-label", `t=${row.t}`));
    for (let pos = 1; pos <= trace.u.length; pos += 1) {
      const classes = ["timeline-cell"];
      if (row.envelope[0] <= pos && pos <= row.envelope[1]) classes.push("in-envelope");
      if (row.box[0] <= pos && pos <= row.box[1]) classes.push("in-box");
      if (pos === row.effectiveEnd) classes.push("effective");
      const cell = el("div", classes.join(" "), String(trace.u[pos - 1]));
      cell.title = `i_Ric position ${pos}, w-position ${freeByIndex.get(pos)?.wPosition ?? pos}`;
      line.appendChild(cell);
    }
    wrap.appendChild(line);
  });
  envelopeBlock.append(wrap, renderLegend([
    ["legend-box envelope", "envelope"],
    ["legend-box ibox", "i-box"],
    ["legend-box effective", "effective end zₜ"],
  ]));

  const chainBlock = el("div", "chain-section");
  const chainHeader = el("div", "chain-section-header");
  chainHeader.appendChild(el("span", "chain-section-title", "i-boxes in ℭ_Ric"));
  chainBlock.appendChild(chainHeader);
  chainBlock.appendChild(renderChainRibbon(trace, {
    showTitle: true,
    titleText: "ℭ_Ric = (𝔠_1,...,𝔠_r)",
    metaText: `i_Ric=(${ric.freeWord.join(", ")}), LR=(${ric.lr.join(", ")})`,
    entryMeta: (row) => {
      const entry = freeByIndex.get(row.t);
      return `${mappedBoxText(row.box)}, ${entry?.side ?? row.side}`;
    },
  }));

  body.append(envelopeBlock, chainBlock);
  section.appendChild(body);

  const dictionary = el("div", "ric-box-dictionary");
  dictionary.appendChild(formulaSpan(`P_Ric={${ric.plusPositions.join(", ")}}`));
  dictionary.appendChild(formulaSpan(`M_Ric={${freeEntries.map((entry) => entry.wPosition).join(", ")}}`));
  dictionary.appendChild(formulaSpan(`i_Ric=(${ric.freeWord.join(", ")})`));
  dictionary.appendChild(formulaSpan(`LR=(${ric.lr.join(", ")})`));
  section.appendChild(dictionary);

  return section;
}

function renderOpenRichardsonDoubleString(trace) {
  const body = el("div", "double-string-block");
  const stringPanel = el("div", "string-construction-panel");
  const header = el("div", "string-panel-header");
  header.appendChild(el("span", "string-panel-title", "CGGLS-Ménard left Richardson double string"));
  stringPanel.appendChild(header);

  const note = el("p", "double-string-rule-note");
  note.append("This is the deleted terminal string in CGGLS Section 10: ");
  note.appendChild(formulaSpan("s_Ric^L=(j_1L,...,j_mL,i_1L,...,i_lL)"));
  note.append(". The superscript + is determined by the recursive Demazure-product length test.");
  stringPanel.appendChild(note);

  const expression = el("div", "double-string-expression");
  expression.appendChild(formulaSpan("s_Ric^L = "));
  const chips = el("div", "double-string-chips");
  trace.doubleString.forEach((entry) => {
    const kind = entry.source === "vc" ? "prefix" : `chain ${lrSideClass(entry.side)}`;
    const chip = el("span", `double-string-chip ${kind}`);
    chip.textContent = formatDoubleStringEntry(entry);
    chip.title = entry.source === "vc"
      ? `from v^c, position ${entry.t}`
      : entry.plus
        ? `from w, plus position ${entry.wPosition}`
        : `from i_Ric, step ${entry.freeIndex}`;
    chips.appendChild(chip);
  });
  expression.appendChild(chips);
  stringPanel.appendChild(expression);
  body.appendChild(stringPanel);

  const preview = el("div", "string-weave-preview");
  const previewHeader = el("div", "string-panel-header");
  previewHeader.appendChild(formulaSpan("𝒲_Ric^L = 𝒲(s_Ric^L)", "formula string-panel-title"));
  previewHeader.appendChild(formulaSpan("double inductive weave attached to s_Ric^L", "formula string-panel-subtitle"));
  preview.appendChild(previewHeader);
  const previewToolbar = el("div", "full-weave-toolbar string-weave-toolbar");
  const sizeControls = el("div", "full-weave-control-group");
  const previewScroll = el("div", "weave-scroll string-weave-scroll");
  const fitSvg = renderBottomWeaveSvg(trace.bottomWeave, true);
  const fullSvg = renderBottomWeaveSvg(trace.bottomWeave, false);
  fullSvg.classList.add("hidden");
  previewScroll.append(fitSvg, fullSvg);
  [
    ["fit", "Fit"],
    ["full", "Full"],
  ].forEach(([mode, label], idx) => {
    const button = el("button", idx === 0 ? "weave-size-button active" : "weave-size-button", label);
    button.type = "button";
    button.addEventListener("click", () => {
      const compactMode = mode === "fit";
      fitSvg.classList.toggle("hidden", !compactMode);
      fullSvg.classList.toggle("hidden", compactMode);
      previewScroll.classList.toggle("full-mode", !compactMode);
      sizeControls.querySelectorAll(".weave-size-button").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
    });
    sizeControls.appendChild(button);
  });
  previewToolbar.appendChild(sizeControls);
  preview.append(previewToolbar, previewScroll);
  body.appendChild(preview);

  return renderCard("s_Ric^L", body);
}

function renderDoubleStringInputTrace(trace) {
  const body = el("div", "double-string-block");
  const panel = el("div", "string-construction-panel");
  const header = el("div", "string-panel-header");
  header.appendChild(el("span", "string-panel-title", "Input double string"));
  panel.appendChild(header);

  const facts = el("div", "ric-data-grid");
  [
    ["type", `${trace.family}_${trace.rank}`],
    ["length", String(trace.doubleString.length)],
    ["β(s)", trace.bottomWeave.words[0]?.join(" ") ?? ""],
    ["δ(β(s))", trace.bottomWeave.finalReducedWord?.join(" ") ?? ""],
  ].forEach(([label, value]) => {
    const row = el("div", "ric-data-row");
    row.appendChild(el("span", "ric-data-key", label));
    row.appendChild(formulaSpan(value, "formula ric-data-value"));
    facts.appendChild(row);
  });
  panel.appendChild(facts);

  const expression = el("div", "double-string-expression");
  expression.appendChild(formulaSpan("s = "));
  const chips = el("div", "double-string-chips");
  trace.doubleString.forEach((entry) => {
    const chip = el("span", `double-string-chip chain ${lrSideClass(entry.side)}`);
    chip.textContent = formatDoubleStringEntry(entry);
    chip.title = entry.plus
      ? `step ${entry.step}: length-additive`
      : `step ${entry.step}: trivalent vertex`;
    chips.appendChild(chip);
  });
  expression.appendChild(chips);
  panel.appendChild(expression);

  const note = el("p", "small-note");
  note.append("The superscript ");
  note.appendChild(formulaSpan("+"));
  note.append(" is recomputed from ");
  note.appendChild(formulaSpan("ℓ(δ(β_{k+1}))=ℓ(δ(β_k))+1"));
  note.append(". Non-");
  note.appendChild(formulaSpan("+"));
  note.append(" entries are the trivalent vertices and hence the cluster variables.");
  panel.appendChild(note);

  body.appendChild(panel);
  return renderCard(trace.doubleStringTitle ?? "s", body);
}

function renderDoubleStringTrace(trace, container) {
  const root = el("div", "trace-view double-string-trace");
  root.append(
    renderDoubleStringInputTrace(trace),
    renderFullWeave(trace),
  );
  container.replaceChildren(root);
}

function renderConstructionStepper(root) {
  const controls = el("div", "construction-stepper");
  const activeClasses = ["step-active-whole", "step-active-chain", "step-active-string", "step-active-compare"];
  const validModes = new Set(["chain", "string", "whole", "compare"]);
  const buttons = new Map();
  const scrollByMode = new Map();
  let activeMode = "chain";
  function stepFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("view") ?? params.get("step");
      return validModes.has(mode) ? mode : "chain";
    } catch {
      return "chain";
    }
  }
  function syncUrl(mode) {
    if (!window.history?.replaceState) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", mode);
    window.history.replaceState(null, "", url);
  }
  function currentScrollY() {
    return window.scrollY ?? document.documentElement.scrollTop ?? 0;
  }
  function defaultStepScrollY() {
    return Math.max(0, root.getBoundingClientRect().top + currentScrollY() - 12);
  }
  function restoreScroll(mode) {
    const y = scrollByMode.has(mode) ? scrollByMode.get(mode) : defaultStepScrollY();
    requestAnimationFrame(() => window.scrollTo({ top: y, left: window.scrollX, behavior: "auto" }));
  }
  function syncCompareItemSizes() {
    const rows = Array.from(root.querySelectorAll(".step-chain .determinantial-row[data-chain-t]"));
    rows.forEach((row) => {
      row.style.height = "";
      const cluster = root.querySelector(`.step-whole .cluster-answer-item[data-cluster="A${row.dataset.chainT}"]`);
      if (cluster) cluster.style.height = "";
    });
    if (!root.classList.contains("step-active-compare")) return;
    requestAnimationFrame(() => {
      if (!root.classList.contains("step-active-compare")) return;
      rows.forEach((row) => {
        const cluster = root.querySelector(`.step-whole .cluster-answer-item[data-cluster="A${row.dataset.chainT}"]`);
        if (!cluster) return;
        row.style.height = "";
        cluster.style.height = "";
        const height = Math.ceil(Math.max(
          row.getBoundingClientRect().height,
          cluster.getBoundingClientRect().height,
        ));
        row.style.height = `${height}px`;
        cluster.style.height = `${height}px`;
      });
    });
  }
  function activateStep(mode, { updateUrl = true, saveScroll = true, restoreStepScroll = true } = {}) {
    if (saveScroll && activeMode !== mode) scrollByMode.set(activeMode, currentScrollY());
    root.classList.remove(...activeClasses);
    root.classList.add(`step-active-${mode}`);
    controls.querySelectorAll(".step-button").forEach((item) => {
      item.classList.toggle("active", item === buttons.get(mode));
    });
    activeMode = mode;
    if (updateUrl) syncUrl(mode);
    if (restoreStepScroll) restoreScroll(mode);
    syncCompareItemSizes();
  }
  const stepSequence = el("div", "step-sequence");
  [
    ["chain", "ℭ"],
    ["string", "s_{Δ̲}(ℭ)"],
    ["whole", "𝒲_{Δ̲}(ℭ)"],
  ].forEach(([mode, label], idx) => {
    const button = el("button", "step-button");
    button.type = "button";
    button.appendChild(mathText(label));
    button.dataset.step = mode;
    button.addEventListener("click", () => activateStep(mode));
    buttons.set(mode, button);
    stepSequence.appendChild(button);
    if (idx < 2) stepSequence.appendChild(el("span", "step-arrow", "→"));
  });
  const viewTools = el("div", "step-view-tools");
  const compareButton = el("button", "step-button compare-step-button");
  compareButton.type = "button";
  compareButton.textContent = "Compare";
  compareButton.dataset.step = "compare";
  compareButton.addEventListener("click", () => activateStep("compare"));
  buttons.set("compare", compareButton);
  viewTools.appendChild(compareButton);
  controls.appendChild(viewTools);
  controls.appendChild(stepSequence);
  controls.activateStep = activateStep;
  controls.syncCompareItemSizes = syncCompareItemSizes;
  activeMode = stepFromUrl();
  activateStep(activeMode, { updateUrl: false, saveScroll: false, restoreStepScroll: false });
  return controls;
}

export function renderTrace(trace, container, options = {}) {
  if (trace.mode === "double-string") {
    renderDoubleStringTrace(trace, container);
    return;
  }
  if (trace.mode === "open-richardson") {
    renderOpenRichardsonTrace(trace, container);
    return;
  }
  const root = el("div", "trace-view step-active-chain");
  const cycleColors = new Map(trace.bottomWeave.lusztigCycles.map((cycle, idx) => [cycle.label, cycleColor(idx)]));
  const controls = renderConstructionStepper(root);
  root.append(
    controls,
    markStepSection(renderFullWeave(trace), ["whole"]),
    markStepSection(renderTimeline(trace, cycleColors, options), ["chain"]),
    markStepSection(renderDoubleString(trace), ["string"]),
  );
  container.replaceChildren(root);
  controls.syncCompareItemSizes?.();
}

export function renderOpenRichardsonTrace(trace, container) {
  const root = el("div", "trace-view open-richardson-trace");
  root.append(
    renderOpenRichardsonSummary(trace),
    renderOpenRichardsonDoubleString(trace),
    renderFullWeave(trace),
  );
  container.replaceChildren(root);
}

export function renderTraceCompare(trace, container, options = {}) {
  const root = el("div", "trace-view step-active-compare embedded-compare-trace");
  const cycleColors = new Map(trace.bottomWeave.lusztigCycles.map((cycle, idx) => [cycle.label, cycleColor(idx)]));
  root.append(
    markStepSection(renderFullWeave(trace), ["whole"]),
    markStepSection(renderTimeline(trace, cycleColors, options), ["chain"]),
  );
  container.replaceChildren(root);
}
