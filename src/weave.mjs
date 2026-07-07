import {
  areAdjacent,
  coxeterLength,
  createDynkinDatum,
  identityCoxeterElement,
  leftMultiplySimpleReflection,
  reducedWordFromCoxeterElement,
  rightMultiplySimpleReflection,
} from "./dynkin.mjs";

function key(word) {
  return word.join(",");
}

function coxeterBraidLength(datum, left, right) {
  if (left === right) return 1;
  if (!datum) return Math.abs(left - right) === 1 ? 3 : 2;
  const product = (datum.cartan[left - 1]?.[right - 1] ?? 0) * (datum.cartan[right - 1]?.[left - 1] ?? 0);
  if (product === 0) return 2;
  if (product === 1) return 3;
  if (product === 2) return 4;
  if (product === 3) return 6;
  return Infinity;
}

function isSimplyLacedDatum(datum) {
  return (datum?.cartan ?? []).every((row, i) => (
    row.every((entry, j) => i === j || entry === 0 || entry === -1)
  ));
}

function cartanSymmetrizer(datum) {
  if (datum?.family === "B") {
    return Array.from({ length: datum.rank }, (_, idx) => (idx + 1 === datum.rank ? 2 : 1));
  }
  if (datum?.family === "C") {
    return Array.from({ length: datum.rank }, (_, idx) => (idx + 1 === datum.rank ? 1 : 2));
  }
  return Array.from({ length: datum?.rank ?? 0 }, () => 1);
}

function isLongShortPair(datum, left, right) {
  return (datum?.cartan[left - 1]?.[right - 1] ?? 0) === -2
    && (datum?.cartan[right - 1]?.[left - 1] ?? 0) === -1;
}

function identityPermutationA(rank) {
  return Array.from({ length: rank + 1 }, (_, idx) => idx + 1);
}

function lengthPermutationA(permutation) {
  let out = 0;
  for (let i = 0; i < permutation.length; i += 1) {
    for (let j = i + 1; j < permutation.length; j += 1) {
      if (permutation[i] > permutation[j]) out += 1;
    }
  }
  return out;
}

function rightMultiplySimpleReflectionA(permutation, generator) {
  const out = permutation.slice();
  const idx = generator - 1;
  [out[idx], out[idx + 1]] = [out[idx + 1], out[idx]];
  return out;
}

function leftMultiplySimpleReflectionA(permutation, generator) {
  const out = permutation.slice();
  const posA = out.indexOf(generator);
  const posB = out.indexOf(generator + 1);
  [out[posA], out[posB]] = [out[posB], out[posA]];
  return out;
}

function reducedWordFromPermutationA(permutation) {
  const arr = permutation.slice();
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

function reducedWordNeighbors(word, datum = null) {
  const out = [];
  for (let pos = 0; pos < word.length - 1; pos += 1) {
    const a = word[pos];
    const b = word[pos + 1];
    const braidLength = coxeterBraidLength(datum, a, b);
    if (a !== b && braidLength === 2) {
      out.push({
        word: [...word.slice(0, pos), b, a, ...word.slice(pos + 2)],
        move: { type: "tetra", pos },
      });
    }
  }
  for (let pos = 0; pos < word.length - 2; pos += 1) {
    const a = word[pos];
    const b = word[pos + 1];
    const c = word[pos + 2];
    const braidLength = coxeterBraidLength(datum, a, b);
    if (a === c && braidLength === 3) {
      out.push({
        word: [...word.slice(0, pos), b, a, b, ...word.slice(pos + 3)],
        move: { type: "hexa", pos },
      });
    }
  }
  for (let pos = 0; pos < word.length - 3; pos += 1) {
    const a = word[pos];
    const b = word[pos + 1];
    const c = word[pos + 2];
    const d = word[pos + 3];
    if (a === c && b === d && coxeterBraidLength(datum, a, b) === 4) {
      out.push({
        word: [...word.slice(0, pos), b, a, b, a, ...word.slice(pos + 4)],
        move: {
          type: "octa",
          pos,
          longFirst: isLongShortPair(datum, a, b),
        },
      });
    }
  }
  return out;
}

function braidPathBetweenWords(startWord, targetWord, datum = null) {
  const startKey = key(startWord);
  const targetKey = key(targetWord);
  if (startKey === targetKey) return { words: [startWord.slice()], moves: [] };

  const queue = [startWord.slice()];
  const previous = new Map([[startKey, { parent: null, move: null, word: startWord.slice() }]]);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const neighbor of reducedWordNeighbors(current, datum)) {
      const neighborKey = key(neighbor.word);
      if (previous.has(neighborKey)) continue;
      previous.set(neighborKey, {
        parent: key(current),
        move: neighbor.move,
        word: neighbor.word,
      });
      if (neighborKey === targetKey) {
        cursor = queue.length;
        break;
      }
      queue.push(neighbor.word);
    }
  }

  if (!previous.has(targetKey)) {
    throw new Error("No braid-only path was found for the double inductive weave.");
  }

  const words = [];
  const moves = [];
  let cursor = targetKey;
  while (cursor !== null) {
    const entry = previous.get(cursor);
    words.push(entry.word.slice());
    if (entry.move !== null) moves.push(entry.move);
    cursor = entry.parent;
  }
  words.reverse();
  moves.reverse();
  return { words, moves };
}

function commonPrefixLength(left, right) {
  let idx = 0;
  while (idx < left.length && idx < right.length && left[idx] === right[idx]) idx += 1;
  return idx;
}

function commonSuffixLength(left, right, prefixLength = 0) {
  let count = 0;
  while (
    count + prefixLength < left.length
    && count + prefixLength < right.length
    && left[left.length - 1 - count] === right[right.length - 1 - count]
  ) count += 1;
  return count;
}

function lcsLength(left, right) {
  const dp = Array(right.length + 1).fill(0);
  for (let i = 0; i < left.length; i += 1) {
    let prev = 0;
    for (let j = 0; j < right.length; j += 1) {
      const saved = dp[j + 1];
      dp[j + 1] = left[i] === right[j]
        ? prev + 1
        : Math.max(dp[j + 1], dp[j]);
      prev = saved;
    }
  }
  return dp[right.length];
}

function targetScore(word, targetWord, depth) {
  const prefix = commonPrefixLength(word, targetWord);
  const suffix = commonSuffixLength(word, targetWord, prefix);
  let hamming = 0;
  for (let idx = 0; idx < word.length; idx += 1) {
    if (word[idx] !== targetWord[idx]) hamming += 1;
  }
  return 160 * prefix + 24 * suffix + 7 * lcsLength(word, targetWord) - 2 * hamming - 0.35 * depth;
}

function reconstructBeamPath(targetKey, records) {
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

function reconstructBidirectionalPath(meetKey, forwardRecords, backwardRecords) {
  const leftWords = [];
  const leftMoves = [];
  let cursor = meetKey;
  while (cursor !== null) {
    const record = forwardRecords.get(cursor);
    leftWords.push(record.word.slice());
    if (record.move !== null) leftMoves.push(record.move);
    cursor = record.parent;
  }
  leftWords.reverse();
  leftMoves.reverse();

  const rightWords = [];
  const rightMoves = [];
  cursor = meetKey;
  while (true) {
    const record = backwardRecords.get(cursor);
    if (!record || record.parent === null) break;
    rightMoves.push(record.move);
    cursor = record.parent;
    rightWords.push(backwardRecords.get(cursor).word.slice());
  }

  return {
    words: [...leftWords, ...rightWords],
    moves: [...leftMoves, ...rightMoves],
  };
}

function bidirectionalBraidPathBetweenWords(startWord, targetWord, datum) {
  const startKey = key(startWord);
  const targetKey = key(targetWord);
  if (startKey === targetKey) return { words: [startWord.slice()], moves: [] };

  const maxVisited = startWord.length <= 20 ? 90000 : 260000;
  const forwardRecords = new Map([[startKey, {
    parent: null,
    move: null,
    word: startWord.slice(),
  }]]);
  const backwardRecords = new Map([[targetKey, {
    parent: null,
    move: null,
    word: targetWord.slice(),
  }]]);
  let forwardFrontier = [startKey];
  let backwardFrontier = [targetKey];

  while (forwardFrontier.length > 0 && backwardFrontier.length > 0) {
    if (forwardRecords.size + backwardRecords.size > maxVisited) break;
    const expandForward = forwardFrontier.length <= backwardFrontier.length;
    const ownRecords = expandForward ? forwardRecords : backwardRecords;
    const otherRecords = expandForward ? backwardRecords : forwardRecords;
    const frontier = expandForward ? forwardFrontier : backwardFrontier;
    const nextFrontier = [];

    for (const currentKey of frontier) {
      const current = ownRecords.get(currentKey);
      for (const neighbor of reducedWordNeighbors(current.word, datum)) {
        const neighborKey = key(neighbor.word);
        if (ownRecords.has(neighborKey)) continue;
        ownRecords.set(neighborKey, {
          parent: currentKey,
          move: neighbor.move,
          word: neighbor.word,
        });
        if (otherRecords.has(neighborKey)) {
          return reconstructBidirectionalPath(neighborKey, forwardRecords, backwardRecords);
        }
        nextFrontier.push(neighborKey);
      }
    }

    if (expandForward) forwardFrontier = nextFrontier;
    else backwardFrontier = nextFrontier;
  }

  throw new Error(`No braid path was found within the bidirectional search limit for type ${datum.label}.`);
}

function beamBraidPathBetweenWords(startWord, targetWord, datum) {
  const startKey = key(startWord);
  const targetKey = key(targetWord);
  if (startKey === targetKey) return { words: [startWord.slice()], moves: [] };

  const maxDepth = Math.max(40, 8 * startWord.length);
  const beamWidth = startWord.length <= 20 ? 2500 : 6500;
  const records = new Map([[startKey, {
    parent: null,
    move: null,
    word: startWord.slice(),
    depth: 0,
  }]]);
  let frontier = [{
    key: startKey,
    word: startWord.slice(),
    score: targetScore(startWord, targetWord, 0),
  }];

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const candidates = new Map();
    frontier.forEach((state) => {
      reducedWordNeighbors(state.word, datum).forEach((neighbor) => {
        const neighborKey = key(neighbor.word);
        if (records.has(neighborKey)) return;
        const score = targetScore(neighbor.word, targetWord, depth);
        const old = candidates.get(neighborKey);
        if (!old || score > old.score) {
          candidates.set(neighborKey, {
            key: neighborKey,
            word: neighbor.word,
            parent: state.key,
            move: neighbor.move,
            depth,
            score,
          });
        }
      });
    });
    const ranked = [...candidates.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, beamWidth);
    for (const entry of ranked) {
      records.set(entry.key, {
        parent: entry.parent,
        move: entry.move,
        word: entry.word,
        depth: entry.depth,
      });
      if (entry.key === targetKey) return reconstructBeamPath(targetKey, records);
    }
    if (ranked.length === 0) break;
    frontier = ranked;
  }

  throw new Error(`No braid path was found quickly for type ${datum.label}. Try a smaller example or type A.`);
}

function fastBraidPathBetweenWords(startWord, targetWord, datum = null) {
  if (!datum || datum.family === "A") return braidPathBetweenWords(startWord, targetWord, datum);
  try {
    return bidirectionalBraidPathBetweenWords(startWord, targetWord, datum);
  } catch {
    return beamBraidPathBetweenWords(startWord, targetWord, datum);
  }
}

function wordHasSideDescent(word, generator, side) {
  if (word.length === 0) return false;
  return side === "L" ? word[0] === generator : word[word.length - 1] === generator;
}

function coxeterElementFromWord(word, datum) {
  let element = identityCoxeterElement(datum);
  word.forEach((generator) => {
    element = rightMultiplySimpleReflection(element, generator, datum);
  });
  return element;
}

function canonicalSideDescentWord(word, generator, side, datum) {
  const element = coxeterElementFromWord(word, datum);
  const shorter = side === "L"
    ? reducedWordFromCoxeterElement(leftMultiplySimpleReflection(element, generator, datum), datum)
    : reducedWordFromCoxeterElement(rightMultiplySimpleReflection(element, generator, datum), datum);
  return side === "L" ? [generator, ...shorter] : [...shorter, generator];
}

function sideDescentScore(word, generator, side, depth) {
  const positions = [];
  word.forEach((entry, idx) => {
    if (entry === generator) positions.push(idx);
  });
  if (positions.length === 0) return -100000 - depth;
  const distance = side === "L"
    ? Math.min(...positions)
    : Math.min(...positions.map((idx) => word.length - 1 - idx));
  const edgeBonus = wordHasSideDescent(word, generator, side) ? 10000 : 0;
  const nearEdgeCount = positions.filter((idx) => (
    side === "L" ? idx <= 3 : word.length - 1 - idx <= 3
  )).length;
  return edgeBonus + 180 * (word.length - distance) + 18 * nearEdgeCount - depth;
}

function braidPathToSideDescent(startWord, generator, side, datum) {
  if (wordHasSideDescent(startWord, generator, side)) {
    return { words: [startWord.slice()], moves: [] };
  }

  if (startWord.length <= 45) {
    try {
      return fastBraidPathBetweenWords(
        startWord,
        canonicalSideDescentWord(startWord, generator, side, datum),
        datum,
      );
    } catch {
      // Fall through to the cheaper target-free search below.
    }
  }

  const startKey = key(startWord);
  const maxDepth = Math.max(40, 10 * startWord.length);
  const beamWidth = startWord.length <= 20 ? 3000 : 9000;
  const records = new Map([[startKey, {
    parent: null,
    move: null,
    word: startWord.slice(),
    depth: 0,
  }]]);
  let frontier = [{
    key: startKey,
    word: startWord.slice(),
    score: sideDescentScore(startWord, generator, side, 0),
  }];

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const candidates = new Map();
    frontier.forEach((state) => {
      reducedWordNeighbors(state.word, datum).forEach((neighbor) => {
        const neighborKey = key(neighbor.word);
        if (records.has(neighborKey)) return;
        const score = sideDescentScore(neighbor.word, generator, side, depth);
        const old = candidates.get(neighborKey);
        if (!old || score > old.score) {
          candidates.set(neighborKey, {
            key: neighborKey,
            word: neighbor.word,
            parent: state.key,
            move: neighbor.move,
            depth,
            score,
          });
        }
      });
    });
    const ranked = [...candidates.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, beamWidth);
    for (const entry of ranked) {
      records.set(entry.key, {
        parent: entry.parent,
        move: entry.move,
        word: entry.word,
        depth: entry.depth,
      });
      if (wordHasSideDescent(entry.word, generator, side)) {
        return reconstructBeamPath(entry.key, records);
      }
    }
    if (ranked.length === 0) break;
    frontier = ranked;
  }

  throw new Error(`No braid path to a ${side === "L" ? "left" : "right"} ${generator}-descent was found quickly for type ${datum.label}.`);
}

function entryLabel(entry) {
  return `${entry.h}${entry.side}${entry.plus ? "+" : ""}`;
}

function applyMoveToCycleWeights(weights, move) {
  const out = weights.slice();
  const p = move.pos;
  if (move.type === "tetra") {
    [out[p], out[p + 1]] = [out[p + 1], out[p]];
    return out;
  }
  if (move.type === "hexa") {
    const a1 = out[p];
    const a2 = out[p + 1];
    const a3 = out[p + 2];
    const min = Math.min(a1, a3);
    return [
      ...out.slice(0, p),
      a2 + a3 - min,
      min,
      a1 + a2 - min,
      ...out.slice(p + 3),
    ];
  }
  if (move.type === "octa") {
    return [
      ...out.slice(0, p),
      out[p + 3],
      out[p + 2],
      out[p + 1],
      out[p],
      ...out.slice(p + 4),
    ];
  }
  if (move.type === "tri") {
    const min = Math.min(out[p], out[p + 1]);
    return [
      ...out.slice(0, p),
      min,
      ...out.slice(p + 2),
    ];
  }
  throw new Error(`Unknown weave move type: ${move.type}`);
}

function computeLusztigCycleForTrivalentVertex(words, moves, triMoveIndex) {
  const rows = [];
  for (let idx = 0; idx <= triMoveIndex; idx += 1) {
    rows.push(Array(words[idx].length).fill(0));
  }
  const p = moves[triMoveIndex].pos;
  let weights = Array(words[triMoveIndex + 1].length).fill(0);
  weights[p] = 1;
  rows.push(weights.slice());
  for (let idx = triMoveIndex + 1; idx < moves.length; idx += 1) {
    weights = applyMoveToCycleWeights(weights, moves[idx]);
    rows.push(weights.slice());
  }
  return rows;
}

function computeAllLusztigCycles(words, moves, stepInfos) {
  return stepInfos
    .filter((info) => !info.plus)
    .map((info) => ({
      label: info.clusterVariable,
      step: info.step,
      generator: info.generator,
      triMoveIndex: info.triMoveIndex,
      cycleRows: computeLusztigCycleForTrivalentVertex(words, moves, info.triMoveIndex),
    }));
}

function formatUMonomial(cycles, rowIdx, edgeIdx) {
  const factors = cycles
    .map((cycle) => ({
      label: cycle.label,
      weight: cycle.cycleRows[rowIdx]?.[edgeIdx] ?? 0,
    }))
    .filter((item) => item.weight > 0)
    .map((item) => (item.weight === 1 ? item.label : `${item.label}^${item.weight}`));
  return factors.length === 0 ? "1" : factors.join("*");
}

function computeURows(words, cycles) {
  return words.map((word, rowIdx) => (
    word.map((_, edgeIdx) => formatUMonomial(cycles, rowIdx, edgeIdx))
  ));
}

function isAtomicExpression(expr) {
  return /^[A-Za-z0-9_]+(\^[0-9]+)?$/.test(expr);
}

function wrapExpression(expr) {
  return isAtomicExpression(expr) ? expr : `(${expr})`;
}

function multiplyExpressions(...factors) {
  const nontrivial = factors.filter((factor) => factor !== "1");
  if (nontrivial.includes("0")) return "0";
  if (nontrivial.length === 0) return "1";
  return nontrivial.map(wrapExpression).join("*");
}

function addExpressions(...terms) {
  const nonzero = terms.filter((term) => term !== "0");
  if (nonzero.length === 0) return "0";
  return nonzero.map(wrapExpression).join(" + ");
}

function negateExpression(expr) {
  if (expr === "0") return "0";
  if (expr === "1") return "-1";
  if (expr.startsWith("-") && isAtomicExpression(expr.slice(1))) return expr.slice(1);
  return `-${wrapExpression(expr)}`;
}

function divideExpressions(numerator, denominator) {
  if (numerator === "0") return "0";
  if (denominator === "1") return numerator;
  return `${wrapExpression(numerator)}/${wrapExpression(denominator)}`;
}

function powerExpression(expr, exponent) {
  if (exponent === 1) return expr;
  if (expr === "1") return "1";
  return `${wrapExpression(expr)}^${exponent}`;
}

function subtractExpressions(left, right) {
  if (right === "0") return left;
  if (left === "0") return negateExpression(right);
  return `${wrapExpression(left)} - ${wrapExpression(right)}`;
}

function zeroMatrix(size) {
  return Array.from({ length: size }, () => Array(size).fill("0"));
}

function identityMatrix(size) {
  const out = zeroMatrix(size);
  for (let idx = 0; idx < size; idx += 1) out[idx][idx] = "1";
  return out;
}

function clearSubmatrix(matrix, indices) {
  indices.forEach((row) => {
    indices.forEach((col) => {
      matrix[row][col] = "0";
    });
  });
}

function embeddedDualBlockMatrix(size, mainPair, dualPair, block) {
  const out = identityMatrix(size);
  const indices = [...mainPair, ...dualPair];
  clearSubmatrix(out, indices);
  const [[a, b], [c, d]] = block;
  out[mainPair[0]][mainPair[0]] = a;
  out[mainPair[0]][mainPair[1]] = b;
  out[mainPair[1]][mainPair[0]] = c;
  out[mainPair[1]][mainPair[1]] = d;

  out[dualPair[0]][dualPair[0]] = a;
  out[dualPair[0]][dualPair[1]] = negateExpression(b);
  out[dualPair[1]][dualPair[0]] = negateExpression(c);
  out[dualPair[1]][dualPair[1]] = d;
  return out;
}

function embeddedBlockMatrix(size, indices, block) {
  const out = identityMatrix(size);
  clearSubmatrix(out, indices);
  indices.forEach((row, rowIdx) => {
    indices.forEach((col, colIdx) => {
      out[row][col] = block[rowIdx][colIdx];
    });
  });
  return out;
}

function xiMatrixA(rank, generator, parameter) {
  const out = identityMatrix(rank + 1);
  out[generator - 1][generator] = parameter;
  return out;
}

function bChiMatrixA(rank, generator, zValue, uValue) {
  const out = identityMatrix(rank + 1);
  const i = generator - 1;
  out[i][i] = multiplyExpressions(zValue, uValue);
  out[i][i + 1] = negateExpression(divideExpressions("1", uValue));
  out[i + 1][i] = uValue;
  out[i + 1][i + 1] = "0";
  return out;
}

function inverseBChiMatrixA(rank, generator, zValue, uValue) {
  const out = identityMatrix(rank + 1);
  const i = generator - 1;
  out[i][i] = "0";
  out[i][i + 1] = divideExpressions("1", uValue);
  out[i + 1][i] = negateExpression(uValue);
  out[i + 1][i + 1] = multiplyExpressions(zValue, uValue);
  return out;
}

function positiveIndexD(index) {
  return index - 1;
}

function negativeIndexD(rank, index) {
  return 2 * rank - index;
}

function zeroIndexB(rank) {
  return rank;
}

function negativeIndexB(rank, index) {
  return 2 * rank + 1 - index;
}

function simpleRootEmbeddingD(rank, generator) {
  if (generator < rank) {
    return {
      root: `epsilon_${generator}-epsilon_${generator + 1}`,
      mainPair: [positiveIndexD(generator), positiveIndexD(generator + 1)],
      dualPair: [negativeIndexD(rank, generator + 1), negativeIndexD(rank, generator)],
      coordinate: [positiveIndexD(generator), positiveIndexD(generator + 1)],
    };
  }
  return {
    root: `epsilon_${rank - 1}+epsilon_${rank}`,
    mainPair: [positiveIndexD(rank - 1), negativeIndexD(rank, rank)],
    dualPair: [positiveIndexD(rank), negativeIndexD(rank, rank - 1)],
    coordinate: [positiveIndexD(rank - 1), negativeIndexD(rank, rank)],
  };
}

function simpleRootEmbeddingB(rank, generator) {
  if (generator < rank) {
    return {
      root: `epsilon_${generator}-epsilon_${generator + 1}`,
      mainPair: [positiveIndexD(generator), positiveIndexD(generator + 1)],
      dualPair: [negativeIndexB(rank, generator + 1), negativeIndexB(rank, generator)],
      coordinate: [positiveIndexD(generator), positiveIndexD(generator + 1)],
      short: false,
    };
  }
  return {
    root: `epsilon_${rank}`,
    triple: [positiveIndexD(rank), zeroIndexB(rank), negativeIndexB(rank, rank)],
    coordinate: [positiveIndexD(rank), zeroIndexB(rank)],
    short: true,
  };
}

function xiMatrixD(rank, generator, parameter) {
  const embedding = simpleRootEmbeddingD(rank, generator);
  return embeddedDualBlockMatrix(2 * rank, embedding.mainPair, embedding.dualPair, [
    ["1", parameter],
    ["0", "1"],
  ]);
}

function bChiMatrixD(rank, generator, zValue, uValue) {
  const embedding = simpleRootEmbeddingD(rank, generator);
  return embeddedDualBlockMatrix(2 * rank, embedding.mainPair, embedding.dualPair, [
    [multiplyExpressions(zValue, uValue), negateExpression(divideExpressions("1", uValue))],
    [uValue, "0"],
  ]);
}

function inverseBChiMatrixD(rank, generator, zValue, uValue) {
  const embedding = simpleRootEmbeddingD(rank, generator);
  return embeddedDualBlockMatrix(2 * rank, embedding.mainPair, embedding.dualPair, [
    ["0", divideExpressions("1", uValue)],
    [negateExpression(uValue), multiplyExpressions(zValue, uValue)],
  ]);
}

function sym2Block([[a, b], [c, d]]) {
  return [
    [powerExpression(a, 2), multiplyExpressions(a, b), powerExpression(b, 2)],
    [twoTimes(multiplyExpressions(a, c)), addExpressions(multiplyExpressions(a, d), multiplyExpressions(b, c)), twoTimes(multiplyExpressions(b, d))],
    [powerExpression(c, 2), multiplyExpressions(c, d), powerExpression(d, 2)],
  ];
}

function xiMatrixB(rank, generator, parameter) {
  const embedding = simpleRootEmbeddingB(rank, generator);
  if (!embedding.short) {
    return embeddedDualBlockMatrix(2 * rank + 1, embedding.mainPair, embedding.dualPair, [
      ["1", parameter],
      ["0", "1"],
    ]);
  }
  return embeddedBlockMatrix(2 * rank + 1, embedding.triple, sym2Block([
    ["1", parameter],
    ["0", "1"],
  ]));
}

function bChiMatrixB(rank, generator, zValue, uValue) {
  const embedding = simpleRootEmbeddingB(rank, generator);
  const block = [
    [multiplyExpressions(zValue, uValue), negateExpression(divideExpressions("1", uValue))],
    [uValue, "0"],
  ];
  if (!embedding.short) {
    return embeddedDualBlockMatrix(2 * rank + 1, embedding.mainPair, embedding.dualPair, block);
  }
  return embeddedBlockMatrix(2 * rank + 1, embedding.triple, sym2Block(block));
}

function inverseBChiMatrixB(rank, generator, zValue, uValue) {
  const embedding = simpleRootEmbeddingB(rank, generator);
  const block = [
    ["0", divideExpressions("1", uValue)],
    [negateExpression(uValue), multiplyExpressions(zValue, uValue)],
  ];
  if (!embedding.short) {
    return embeddedDualBlockMatrix(2 * rank + 1, embedding.mainPair, embedding.dualPair, block);
  }
  return embeddedBlockMatrix(2 * rank + 1, embedding.triple, sym2Block(block));
}

function coordinatePinning(datum) {
  if (datum.family === "A") {
    return {
      available: true,
      family: "A",
      group: `SL_${datum.rank + 1}(C)`,
      label: `standard SL_${datum.rank + 1}(C) pinning`,
      description: "Simple root i is embedded in rows and columns i,i+1; B_i(z)=x_i(z) dot{s_i}.",
      matrixSize: datum.rank + 1,
      simpleRoots: Array.from({ length: datum.rank }, (_, idx) => `alpha_${idx + 1}=epsilon_${idx + 1}-epsilon_${idx + 2}`),
      xiMatrix: (generator, parameter) => xiMatrixA(datum.rank, generator, parameter),
      bChiMatrix: (generator, zValue, uValue) => bChiMatrixA(datum.rank, generator, zValue, uValue),
      inverseBChiMatrix: (generator, zValue, uValue) => inverseBChiMatrixA(datum.rank, generator, zValue, uValue),
      xiCoordinate: (matrix, generator) => matrixEntry(matrix, generator - 1, generator),
    };
  }
  if (datum.family === "B") {
    return {
      available: true,
      family: "B",
      group: `SO_${2 * datum.rank + 1}(C)`,
      label: `standard SO_${2 * datum.rank + 1}(C) Chevalley pinning`,
      description: "The basis is e_1,...,e_n,e_0,e_{-n},...,e_{-1}; the form pairs e_i with e_{-i} and fixes e_0.",
      matrixSize: 2 * datum.rank + 1,
      simpleRoots: Array.from({ length: datum.rank }, (_, idx) => simpleRootEmbeddingB(datum.rank, idx + 1).root),
      xiMatrix: (generator, parameter) => xiMatrixB(datum.rank, generator, parameter),
      bChiMatrix: (generator, zValue, uValue) => bChiMatrixB(datum.rank, generator, zValue, uValue),
      inverseBChiMatrix: (generator, zValue, uValue) => inverseBChiMatrixB(datum.rank, generator, zValue, uValue),
      xiCoordinate: (matrix, generator) => {
        const [row, col] = simpleRootEmbeddingB(datum.rank, generator).coordinate;
        return matrixEntry(matrix, row, col);
      },
    };
  }
  if (datum.family === "C") {
    return {
      available: true,
      family: "C",
      group: `Sp_${2 * datum.rank}(C)`,
      label: `standard Sp_${2 * datum.rank}(C) Chevalley pinning`,
      description: "The basis is e_1,...,e_n,e_{-n},...,e_{-1}; the symplectic form pairs e_i with e_{-i}. Coordinate formulas are shown through the folding model.",
      matrixSize: 2 * datum.rank,
      simpleRoots: Array.from({ length: datum.rank }, (_, idx) => (
        idx + 1 === datum.rank
          ? `alpha_${datum.rank}=2 epsilon_${datum.rank}`
          : `alpha_${idx + 1}=epsilon_${idx + 1}-epsilon_${idx + 2}`
      )),
    };
  }
  if (datum.family === "D") {
    return {
      available: true,
      family: "D",
      group: `SO_${2 * datum.rank}(C)`,
      label: `standard SO_${2 * datum.rank}(C) Chevalley pinning`,
      description: "The basis is e_1,...,e_n,e_{-n},...,e_{-1}; the form pairs e_i with e_{-i}.",
      matrixSize: 2 * datum.rank,
      simpleRoots: Array.from({ length: datum.rank }, (_, idx) => simpleRootEmbeddingD(datum.rank, idx + 1).root),
      xiMatrix: (generator, parameter) => xiMatrixD(datum.rank, generator, parameter),
      bChiMatrix: (generator, zValue, uValue) => bChiMatrixD(datum.rank, generator, zValue, uValue),
      inverseBChiMatrix: (generator, zValue, uValue) => inverseBChiMatrixD(datum.rank, generator, zValue, uValue),
      xiCoordinate: (matrix, generator) => {
        const [row, col] = simpleRootEmbeddingD(datum.rank, generator).coordinate;
        return matrixEntry(matrix, row, col);
      },
    };
  }
  return {
    available: false,
    family: datum.family,
    group: "",
    label: `coordinate pinning not implemented for type ${datum.label}`,
    description: "",
    matrixSize: 0,
    simpleRoots: [],
  };
}

function multiplyMatrices(left, right) {
  const size = left.length;
  const out = zeroMatrix(size);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const terms = [];
      for (let mid = 0; mid < size; mid += 1) {
        terms.push(multiplyExpressions(left[row][mid], right[mid][col]));
      }
      out[row][col] = addExpressions(...terms);
    }
  }
  return out;
}

function matrixEntry(matrix, row, col) {
  return matrix[row]?.[col] ?? "0";
}

function updateDashedMatrix(pinning, generator, zBottom, uBottom, currentY, zTop, uTop) {
  return multiplyMatrices(
    multiplyMatrices(pinning.inverseBChiMatrix(generator, zBottom, uBottom), currentY),
    pinning.bChiMatrix(generator, zTop, uTop),
  );
}

function twoTimes(expr) {
  return multiplyExpressions("2", expr);
}

function octaTopCoordinateExpressions(row, p, longFirst) {
  const z0 = row[p];
  const z1 = row[p + 1];
  const z2 = row[p + 2];
  const z3 = row[p + 3];
  if (longFirst) {
    return [
      z3,
      addExpressions(
        z2,
        subtractExpressions(multiplyExpressions(z0, powerExpression(z3, 2)), twoTimes(multiplyExpressions(z1, z3))),
      ),
      subtractExpressions(multiplyExpressions(z0, z3), z1),
      z0,
    ];
  }
  return [
    z3,
    subtractExpressions(multiplyExpressions(z0, z3), z2),
    addExpressions(
      z1,
      subtractExpressions(multiplyExpressions(powerExpression(z0, 2), z3), twoTimes(multiplyExpressions(z0, z2))),
    ),
    z0,
  ];
}

function octaBottomCoordinateExpressions(rowz, rowu, nextu, p, longFirst) {
  const z0 = rowz[p];
  const z1 = rowz[p + 1];
  const z2 = rowz[p + 2];
  const z3 = rowz[p + 3];
  const u0 = rowu[p];
  const u1 = rowu[p + 1];
  const u2 = rowu[p + 2];
  const u3 = rowu[p + 3];
  const v0 = nextu[p];
  const v1 = nextu[p + 1];
  const v2 = nextu[p + 2];
  const v3 = nextu[p + 3];

  if (longFirst) {
    const w0 = divideExpressions(multiplyExpressions(z3, u0), u2);
    const w2 = divideExpressions(
      multiplyExpressions(v1, subtractExpressions(multiplyExpressions(z0, z3, powerExpression(u0, 2)), multiplyExpressions(z1, u2))),
      multiplyExpressions(u0, u2),
    );
    const w3 = divideExpressions(
      multiplyExpressions(z0, u0, powerExpression(u1, 2), u2),
      multiplyExpressions(powerExpression(v0, 2), v1, v3),
    );
    const numerator = addExpressions(
      multiplyExpressions(z0, powerExpression(z3, 2), powerExpression(u0, 2), powerExpression(u1, 2)),
      subtractExpressions(
        multiplyExpressions(z2, powerExpression(u2, 2)),
        twoTimes(multiplyExpressions(z1, z3, powerExpression(u1, 2), u2)),
      ),
    );
    const w1 = divideExpressions(
      multiplyExpressions(powerExpression(u3, 2), v3, numerator),
      multiplyExpressions(u0, powerExpression(u1, 2), u2, v1),
    );
    return [w0, w1, w2, w3];
  }

  const w0 = divideExpressions(
    multiplyExpressions(z3, powerExpression(u0, 2), u1, u3),
    multiplyExpressions(v0, powerExpression(v1, 2), v2),
  );
  const w1 = divideExpressions(
    multiplyExpressions(u3, subtractExpressions(multiplyExpressions(z0, z3, powerExpression(u0, 2), u1), multiplyExpressions(z2, powerExpression(u2, 2)))),
    multiplyExpressions(powerExpression(v1, 2), v2),
  );
  const numerator = addExpressions(
    multiplyExpressions(powerExpression(z0, 2), z3, powerExpression(u0, 4), u1),
    subtractExpressions(
      multiplyExpressions(z1, u1, powerExpression(u2, 2)),
      twoTimes(multiplyExpressions(z0, z2, powerExpression(u0, 2), powerExpression(u2, 2))),
    ),
  );
  const w2 = divideExpressions(
    multiplyExpressions(u3, numerator),
    multiplyExpressions(powerExpression(u0, 2), v0, v2),
  );
  const w3 = divideExpressions(multiplyExpressions(z0, v2), v0);
  return [w0, w1, w2, w3];
}

function computeZRowsAndDashedRays(pinning, words, moves, uRows, stepInfos, coordinatePrefix = "z") {
  const zRows = [words[0].map((_, idx) => `${coordinatePrefix}${idx + 1}`)];
  const dashedRays = [];
  const triInfoByIndex = new Map(
    stepInfos.filter((info) => !info.plus).map((info) => [info.triMoveIndex, info]),
  );

  moves.forEach((move, stripIdx) => {
    const rowz = zRows[zRows.length - 1];
    const rowu = uRows[stripIdx];
    const nextu = uRows[stripIdx + 1];
    const p = move.pos;
    if (move.type === "tetra") {
      zRows.push([
        ...rowz.slice(0, p),
        rowz[p + 1],
        rowz[p],
        ...rowz.slice(p + 2),
      ]);
      return;
    }
    if (move.type === "tri") {
      const denominator = multiplyExpressions(powerExpression(rowu[p], 2), rowz[p + 1]);
      const zSouth = subtractExpressions(rowz[p], divideExpressions("1", denominator));
      const nextz = [
        ...rowz.slice(0, p),
        zSouth,
      ];
      const color = words[stripIdx][p];
      const initialParameter = negateExpression(
        divideExpressions("1", multiplyExpressions(rowz[p + 1], powerExpression(rowu[p + 1], 2))),
      );
      let currentY = pinning.xiMatrix(color, initialParameter);
      const crossings = [];
      for (let topIdx = p + 2; topIdx < words[stripIdx].length; topIdx += 1) {
        const botIdx = topIdx - 1;
        const crossingColor = words[stripIdx][topIdx];
        const zTop = rowz[topIdx];
        const uTop = rowu[topIdx];
        const uBottom = nextu[botIdx];
        const xiEntry = pinning.xiCoordinate(currentY, crossingColor);
        const zBottom = addExpressions(zTop, xiEntry);
        const nextY = updateDashedMatrix(pinning, crossingColor, zBottom, uBottom, currentY, zTop, uTop);
        crossings.push({
          virtualIndex: crossings.length + 1,
          color: crossingColor,
          topEdge: topIdx + 1,
          bottomEdge: botIdx + 1,
          zTop,
          uTop,
          zBottom,
          uBottom,
          yBefore: currentY,
          yAfter: nextY,
          xiEntry,
        });
        nextz.push(zBottom);
        currentY = nextY;
      }
      zRows.push(nextz);
      const triInfo = triInfoByIndex.get(stripIdx);
      if (triInfo) {
        dashedRays.push({
          label: triInfo.clusterVariable,
          step: triInfo.step,
          triMoveIndex: stripIdx,
          color,
          initialY: pinning.xiMatrix(color, initialParameter),
          crossings,
          finalY: currentY,
        });
      }
      return;
    }
    if (move.type === "hexa") {
      const zNw = rowz[p];
      const zN = rowz[p + 1];
      const zNe = rowz[p + 2];
      const uNw = rowu[p];
      const uN = rowu[p + 1];
      const uNe = rowu[p + 2];
      const uSw = nextu[p];
      const uS = nextu[p + 1];
      const zSw = divideExpressions(multiplyExpressions(zNe, uNw), uN);
      const zSe = divideExpressions(multiplyExpressions(zNw, uS), uSw);
      const numeratorLeft = multiplyExpressions(zNw, zNe, powerExpression(uNw, 2), uNe);
      const numeratorRight = multiplyExpressions(zN, uSw, uS);
      const zS = divideExpressions(subtractExpressions(numeratorLeft, numeratorRight), multiplyExpressions(uNw, uS));
      zRows.push([
        ...rowz.slice(0, p),
        zSw,
        zS,
        zSe,
        ...rowz.slice(p + 3),
      ]);
      return;
    }
    if (move.type === "octa") {
      zRows.push([
        ...rowz.slice(0, p),
        ...octaBottomCoordinateExpressions(rowz, rowu, nextu, p, move.longFirst),
        ...rowz.slice(p + 4),
      ]);
      return;
    }
    throw new Error(`Unknown weave move type: ${move.type}`);
  });
  return { zRows, dashedRays };
}

class ExpressionExpansionError extends Error {}

const MAX_POLYNOMIAL_TERMS = 600;
const MAX_DENOMINATOR_FACTORS = 16;
const MAX_POLYNOMIAL_DIVISION_STEPS = 4000;

function naturalNameParts(name) {
  const match = /^([A-Za-z_]+)([0-9]+)$/.exec(name);
  if (!match) return [name, -1];
  return [match[1], Number(match[2])];
}

function compareVariableNames(left, right) {
  const [leftBase, leftIndex] = naturalNameParts(left);
  const [rightBase, rightIndex] = naturalNameParts(right);
  if (leftBase !== rightBase) return leftBase < rightBase ? -1 : 1;
  if (leftIndex !== rightIndex) return leftIndex - rightIndex;
  return left < right ? -1 : left > right ? 1 : 0;
}

function monomialKey(exponents) {
  return Object.entries(exponents)
    .filter(([, exponent]) => exponent !== 0)
    .sort(([left], [right]) => compareVariableNames(left, right))
    .map(([name, exponent]) => `${name}:${exponent}`)
    .join(";");
}

function keyToExponents(keyValue) {
  if (keyValue === "") return {};
  const out = {};
  keyValue.split(";").forEach((piece) => {
    const [name, exponent] = piece.split(":");
    out[name] = Number(exponent);
  });
  return out;
}

function cleanPolynomial(poly) {
  const out = new Map();
  poly.forEach((coefficient, keyValue) => {
    if (coefficient !== 0) out.set(keyValue, coefficient);
  });
  if (out.size > MAX_POLYNOMIAL_TERMS) {
    throw new ExpressionExpansionError("The expanded cluster expression is too large.");
  }
  return out;
}

function constantPolynomial(value) {
  return value === 0 ? new Map() : new Map([["", value]]);
}

function variablePolynomial(name) {
  return new Map([[monomialKey({ [name]: 1 }), 1]]);
}

function isZeroPolynomial(poly) {
  return cleanPolynomial(poly).size === 0;
}

function isOnePolynomial(poly) {
  const cleaned = cleanPolynomial(poly);
  return cleaned.size === 1 && cleaned.get("") === 1;
}

function addPolynomials(left, right) {
  const out = new Map(left);
  right.forEach((coefficient, keyValue) => {
    out.set(keyValue, (out.get(keyValue) ?? 0) + coefficient);
  });
  return cleanPolynomial(out);
}

function negatePolynomial(poly) {
  const out = new Map();
  poly.forEach((coefficient, keyValue) => out.set(keyValue, -coefficient));
  return cleanPolynomial(out);
}

function subtractPolynomials(left, right) {
  return addPolynomials(left, negatePolynomial(right));
}

function addExponents(leftKey, rightKey) {
  const out = keyToExponents(leftKey);
  Object.entries(keyToExponents(rightKey)).forEach(([name, exponent]) => {
    out[name] = (out[name] ?? 0) + exponent;
  });
  return monomialKey(out);
}

function multiplyPolynomials(left, right) {
  if (isZeroPolynomial(left) || isZeroPolynomial(right)) return constantPolynomial(0);
  const out = new Map();
  left.forEach((leftCoefficient, leftKey) => {
    right.forEach((rightCoefficient, rightKey) => {
      const keyValue = addExponents(leftKey, rightKey);
      out.set(keyValue, (out.get(keyValue) ?? 0) + leftCoefficient * rightCoefficient);
    });
  });
  return cleanPolynomial(out);
}

function powerPolynomial(poly, exponent) {
  if (exponent === 0) return constantPolynomial(1);
  let out = constantPolynomial(1);
  for (let idx = 0; idx < exponent; idx += 1) {
    out = multiplyPolynomials(out, poly);
  }
  return out;
}

function polynomialCanonicalKey(poly) {
  return [...cleanPolynomial(poly).entries()]
    .sort(([left], [right]) => compareMonomialKeys(left, right))
    .map(([keyValue, coefficient]) => `${keyValue}=${coefficient}`)
    .join("|");
}

function compareMonomialKeys(left, right) {
  const leftExp = keyToExponents(left);
  const rightExp = keyToExponents(right);
  const leftDegree = Object.values(leftExp).reduce((sum, value) => sum + value, 0);
  const rightDegree = Object.values(rightExp).reduce((sum, value) => sum + value, 0);
  if (leftDegree !== rightDegree) return rightDegree - leftDegree;
  const names = [...new Set([...Object.keys(leftExp), ...Object.keys(rightExp)])]
    .sort(compareVariableNames);
  for (const name of names) {
    const diff = (rightExp[name] ?? 0) - (leftExp[name] ?? 0);
    if (diff !== 0) return diff;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

function monomialDivides(divisorKey, dividendKey) {
  const divisor = keyToExponents(divisorKey);
  const dividend = keyToExponents(dividendKey);
  return Object.entries(divisor).every(([name, exponent]) => (dividend[name] ?? 0) >= exponent);
}

function subtractExponents(dividendKey, divisorKey) {
  const out = keyToExponents(dividendKey);
  Object.entries(keyToExponents(divisorKey)).forEach(([name, exponent]) => {
    out[name] = (out[name] ?? 0) - exponent;
  });
  return monomialKey(out);
}

function leadingTerm(poly) {
  const entries = [...cleanPolynomial(poly).entries()];
  if (entries.length === 0) return null;
  entries.sort(([left], [right]) => compareMonomialKeys(left, right));
  const [keyValue, coefficient] = entries[0];
  return { key: keyValue, coefficient };
}

function dividePolynomialExact(dividend, divisor) {
  const divisorClean = cleanPolynomial(divisor);
  if (isZeroPolynomial(divisorClean)) return null;
  if (isOnePolynomial(divisorClean)) return cleanPolynomial(dividend);

  let remainder = cleanPolynomial(dividend);
  let quotient = constantPolynomial(0);
  const divisorLead = leadingTerm(divisorClean);
  let steps = 0;

  while (!isZeroPolynomial(remainder)) {
    steps += 1;
    if (quotient.size > MAX_POLYNOMIAL_TERMS) {
      throw new ExpressionExpansionError("The expanded cluster expression is too large.");
    }
    if (steps > MAX_POLYNOMIAL_DIVISION_STEPS) {
      throw new ExpressionExpansionError("Polynomial cancellation is too large.");
    }
    const remainderLead = leadingTerm(remainder);
    if (!monomialDivides(divisorLead.key, remainderLead.key)) return null;
    if (remainderLead.coefficient % divisorLead.coefficient !== 0) return null;

    const termKey = subtractExponents(remainderLead.key, divisorLead.key);
    const termCoefficient = remainderLead.coefficient / divisorLead.coefficient;
    const term = new Map([[termKey, termCoefficient]]);
    quotient = addPolynomials(quotient, term);
    remainder = subtractPolynomials(remainder, multiplyPolynomials(term, divisorClean));
  }
  return cleanPolynomial(quotient);
}

function makeRational(num, denFactors = []) {
  let numerator = cleanPolynomial(num);
  if (isZeroPolynomial(numerator)) return { num: constantPolynomial(0), denFactors: [] };

  const remaining = [];
  denFactors.forEach((factor) => {
    const cleanedFactor = cleanPolynomial(factor);
    if (isOnePolynomial(cleanedFactor)) return;
    const quotient = dividePolynomialExact(numerator, cleanedFactor);
    if (quotient) {
      numerator = quotient;
    } else {
      remaining.push(cleanedFactor);
    }
  });
  if (remaining.length > MAX_DENOMINATOR_FACTORS) {
    throw new ExpressionExpansionError("The expanded cluster denominator is too large.");
  }
  return { num: numerator, denFactors: remaining };
}

function rationalFromInteger(value) {
  return makeRational(constantPolynomial(value));
}

function cloneRational(value) {
  return makeRational(new Map(value.num), value.denFactors.map((factor) => new Map(factor)));
}

function multiplyRationals(left, right) {
  return makeRational(
    multiplyPolynomials(left.num, right.num),
    [...left.denFactors, ...right.denFactors],
  );
}

function negateRational(value) {
  return makeRational(negatePolynomial(value.num), value.denFactors);
}

function denominatorProduct(value) {
  return value.denFactors.reduce(
    (product, factor) => multiplyPolynomials(product, factor),
    constantPolynomial(1),
  );
}

function addRationals(left, right) {
  const leftScale = denominatorProduct(right);
  const rightScale = denominatorProduct(left);
  return makeRational(
    addPolynomials(
      multiplyPolynomials(left.num, leftScale),
      multiplyPolynomials(right.num, rightScale),
    ),
    [...left.denFactors, ...right.denFactors],
  );
}

function subtractRationals(left, right) {
  return addRationals(left, negateRational(right));
}

function divideRationals(left, right) {
  if (isZeroPolynomial(right.num)) throw new Error("Division by zero in cluster-variable calculation.");
  const numerator = right.denFactors.reduce(
    (product, factor) => multiplyPolynomials(product, factor),
    left.num,
  );
  return makeRational(numerator, [...left.denFactors, right.num]);
}

function powerRational(value, exponent) {
  if (exponent < 0) {
    return divideRationals(rationalFromInteger(1), powerRational(value, -exponent));
  }
  let out = rationalFromInteger(1);
  for (let idx = 0; idx < exponent; idx += 1) out = multiplyRationals(out, value);
  return out;
}

function formatMonomial(keyValue) {
  const exponents = keyToExponents(keyValue);
  const pieces = Object.entries(exponents)
    .sort(([left], [right]) => compareVariableNames(left, right))
    .map(([name, exponent]) => (exponent === 1 ? name : `${name}^${exponent}`));
  return pieces.length === 0 ? "1" : pieces.join("*");
}

function formatPolynomial(poly) {
  const entries = [...cleanPolynomial(poly).entries()]
    .sort(([left], [right]) => compareMonomialKeys(left, right));
  if (entries.length === 0) return "0";

  return entries.map(([keyValue, coefficient], idx) => {
    const absCoefficient = Math.abs(coefficient);
    const monomial = formatMonomial(keyValue);
    const unsigned = monomial === "1"
      ? String(absCoefficient)
      : absCoefficient === 1
        ? monomial
        : `${absCoefficient}*${monomial}`;
    if (idx === 0) return coefficient < 0 ? `-${unsigned}` : unsigned;
    return coefficient < 0 ? ` - ${unsigned}` : ` + ${unsigned}`;
  }).join("");
}

function formatPolynomialFactor(poly) {
  const text = formatPolynomial(poly);
  return cleanPolynomial(poly).size <= 1 ? text : `(${text})`;
}

function formatRational(value) {
  const simplified = makeRational(value.num, value.denFactors);
  if (simplified.denFactors.length === 0) return formatPolynomial(simplified.num);
  const denominator = simplified.denFactors.map(formatPolynomialFactor).join("*");
  return `${formatPolynomialFactor(simplified.num)}/${denominator}`;
}

function tokenizeExpression(expr) {
  const tokens = [];
  let idx = 0;
  while (idx < expr.length) {
    const char = expr[idx];
    if (/\s/.test(char)) {
      idx += 1;
      continue;
    }
    if ("()+-*/^".includes(char)) {
      tokens.push({ type: char, value: char });
      idx += 1;
      continue;
    }
    const numberMatch = /^[0-9]+/.exec(expr.slice(idx));
    if (numberMatch) {
      tokens.push({ type: "number", value: numberMatch[0] });
      idx += numberMatch[0].length;
      continue;
    }
    const nameMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(expr.slice(idx));
    if (nameMatch) {
      tokens.push({ type: "name", value: nameMatch[0] });
      idx += nameMatch[0].length;
      continue;
    }
    throw new Error(`Could not parse expression near "${expr.slice(idx)}".`);
  }
  return tokens;
}

function parseRationalExpression(expr, substitutions = new Map()) {
  const tokens = tokenizeExpression(expr);
  let cursor = 0;

  function peek(type = null) {
    const token = tokens[cursor] ?? null;
    if (type === null) return token;
    return token?.type === type;
  }

  function consume(type) {
    if (!peek(type)) throw new Error(`Expected "${type}" while parsing "${expr}".`);
    const token = tokens[cursor];
    cursor += 1;
    return token;
  }

  function parseExpression() {
    let out = parseTerm();
    while (peek("+") || peek("-")) {
      const op = consume(peek("+") ? "+" : "-").type;
      const right = parseTerm();
      out = op === "+" ? addRationals(out, right) : subtractRationals(out, right);
    }
    return out;
  }

  function parseTerm() {
    let out = parsePower();
    while (peek("*") || peek("/")) {
      const op = consume(peek("*") ? "*" : "/").type;
      const right = parsePower();
      out = op === "*" ? multiplyRationals(out, right) : divideRationals(out, right);
    }
    return out;
  }

  function parsePower() {
    let out = parseUnary();
    if (peek("^")) {
      consume("^");
      const exponentToken = consume("number");
      out = powerRational(out, Number(exponentToken.value));
    }
    return out;
  }

  function parseUnary() {
    if (peek("-")) {
      consume("-");
      return negateRational(parseUnary());
    }
    return parsePrimary();
  }

  function parsePrimary() {
    if (peek("number")) {
      return rationalFromInteger(Number(consume("number").value));
    }
    if (peek("name")) {
      const name = consume("name").value;
      if (substitutions.has(name)) return cloneRational(substitutions.get(name));
      return makeRational(variablePolynomial(name));
    }
    consume("(");
    const out = parseExpression();
    consume(")");
    return out;
  }

  const out = parseExpression();
  if (cursor !== tokens.length) throw new Error(`Unexpected token while parsing "${expr}".`);
  return out;
}

function computeClusterValues(words, moves, uRows, zRows, stepInfos) {
  const substitutions = new Map();
  return stepInfos
    .filter((info) => !info.plus)
    .map((info) => {
      const stripIdx = info.triMoveIndex;
      const move = moves[stripIdx];
      const p = move.pos;
      const baseValue = {
        label: info.clusterVariable,
        step: info.step,
        entryLabel: info.entryLabel,
        triMoveIndex: stripIdx,
        edge: p + 1,
        color: words[stripIdx][p],
        symbolic_u_s: uRows[stripIdx + 1][p],
        symbolic_z_s: zRows[stripIdx + 1][p],
        symbolic_u_nw: uRows[stripIdx][p],
        symbolic_u_ne: uRows[stripIdx][p + 1],
        symbolic_z_nw: zRows[stripIdx][p],
        symbolic_z_ne: zRows[stripIdx][p + 1],
      };

      try {
        const zNe = parseRationalExpression(zRows[stripIdx][p + 1], substitutions);
        const uNw = parseRationalExpression(uRows[stripIdx][p], substitutions);
        const uNe = parseRationalExpression(uRows[stripIdx][p + 1], substitutions);
        const expanded = multiplyRationals(multiplyRationals(zNe, uNw), uNe);
        substitutions.set(info.clusterVariable, expanded);
        const zSouth = parseRationalExpression(zRows[stripIdx + 1][p], substitutions);

        return {
          ...baseValue,
          expression: formatRational(expanded),
          u_s: formatRational(expanded),
          z_s: formatRational(zSouth),
          u_nw: formatRational(uNw),
          u_ne: formatRational(uNe),
          z_nw: formatRational(parseRationalExpression(zRows[stripIdx][p], substitutions)),
          z_ne: formatRational(zNe),
          expansionWarning: "",
        };
      } catch (error) {
        if (!(error instanceof ExpressionExpansionError)) throw error;
        substitutions.delete(info.clusterVariable);
        const expression = multiplyExpressions(zRows[stripIdx][p + 1], uRows[stripIdx][p], uRows[stripIdx][p + 1]);
        return {
          ...baseValue,
          expression,
          u_s: expression,
          z_s: zRows[stripIdx + 1][p],
          u_nw: uRows[stripIdx][p],
          u_ne: uRows[stripIdx][p + 1],
          z_nw: zRows[stripIdx][p],
          z_ne: zRows[stripIdx][p + 1],
          expansionWarning: "The expanded expression is large, so the recursive expression is displayed.",
        };
      }
    });
}

function det3Rows(r1, r2, r3) {
  return r1[0] * (r2[1] * r3[2] - r2[2] * r3[1])
    - r1[1] * (r2[0] * r3[2] - r2[2] * r3[0])
    + r1[2] * (r2[0] * r3[1] - r2[1] * r3[0]);
}

function cyclicAreaPair(row1, row2) {
  let total = 0;
  for (let idx = 0; idx < row1.length; idx += 1) {
    const next = (idx + 1) % row1.length;
    total += row1[idx] * row2[next] - row1[next] * row2[idx];
  }
  return 0.5 * total;
}

function simpleRootVector(rank, generator) {
  const out = Array(rank).fill(0);
  out[generator - 1] = 1;
  return out;
}

function reflectRootVector(vector, generator, cartan) {
  const out = vector.slice();
  const idx = generator - 1;
  let pair = 0;
  for (let col = 0; col < vector.length; col += 1) {
    pair += cartan[idx][col] * vector[col];
  }
  out[idx] -= pair;
  return out;
}

function pairingRoot(left, right, cartan) {
  let out = 0;
  for (let i = 0; i < left.length; i += 1) {
    for (let j = 0; j < right.length; j += 1) {
      out += left[i] * cartan[i][j] * right[j];
    }
  }
  return out;
}

function bottomRootSequence(word, datum) {
  const cartan = datum.cartan;
  const prefix = [];
  const roots = [];
  word.forEach((generator) => {
    let root = simpleRootVector(datum.rank, generator);
    prefix.forEach((reflection) => {
      root = reflectRootVector(root, reflection, cartan);
    });
    roots.push(root);
    prefix.push(generator);
  });
  return { roots, cartan };
}

function signInt(value) {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function boundaryIntersection(bottomWord, row1, row2, datum) {
  const { roots, cartan } = bottomRootSequence(bottomWord, datum);
  let total = 0;
  for (let i = 0; i < bottomWord.length; i += 1) {
    for (let j = 0; j < bottomWord.length; j += 1) {
      total += 0.5
        * signInt((j + 1) - (i + 1))
        * (row1[i] ?? 0)
        * (row2[j] ?? 0)
        * pairingRoot(roots[i], roots[j], cartan);
    }
  }
  return total;
}

function formatQuiverWeight(value) {
  if (Math.abs(value - Math.round(value)) < 1e-9) return Math.round(value);
  if (Math.abs(value * 2 - Math.round(value * 2)) < 1e-9) {
    return `${Math.round(value * 2)}/2`;
  }
  return Number(value.toFixed(6));
}

function quiverWeightNumeric(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.includes("/")) {
    const [num, den] = value.split("/").map(Number);
    return num / den;
  }
  return Number(value);
}

function computeQuiverData(words, moves, cycles, dashedRays, datum) {
  const simplyLaced = isSimplyLacedDatum(datum);
  const labels = cycles.map((cycle) => cycle.label);
  const cycleLookup = new Map(cycles.map((cycle) => [cycle.label, cycle]));
  const frozen = cycles
    .filter((cycle) => cycle.cycleRows[cycle.cycleRows.length - 1].some((weight) => weight !== 0))
    .map((cycle) => cycle.label);
  const frozenSet = new Set(frozen);
  const exchangeable = labels.filter((label) => !frozenSet.has(label));
  const epsilon = Object.fromEntries(labels.map((label) => [
    label,
    Object.fromEntries(labels.map((other) => [other, 0])),
  ]));
  const contributions = Object.fromEntries(labels.map((label) => [
    label,
    Object.fromEntries(labels.map((other) => [other, []])),
  ]));

  function pushContribution(list, entry) {
    if (Math.abs(entry.numericValue) < 1e-9) return;
    list.push({
      ...entry,
      value: formatQuiverWeight(entry.numericValue),
    });
  }

  labels.forEach((a) => {
    labels.forEach((b) => {
      if (a === b) return;
      const ca = cycleLookup.get(a).cycleRows;
      const cb = cycleLookup.get(b).cycleRows;
      let total = 0;
      const pairContributions = [];

      moves.forEach((move, stripIdx) => {
        const p = move.pos;
        if (move.type === "tri") {
          const localValue = det3Rows(
            [1, 1, 1],
            [ca[stripIdx][p], ca[stripIdx + 1][p], ca[stripIdx][p + 1]],
            [cb[stripIdx][p], cb[stripIdx + 1][p], cb[stripIdx][p + 1]],
          );
          total += localValue;
          pushContribution(pairContributions, {
            kind: "tri",
            moveType: move.type,
            stripIdx,
            pos: p,
            numericValue: localValue,
          });
        } else if (move.type === "hexa") {
          const topValue = 0.5 * det3Rows(
            [1, 1, 1],
            [ca[stripIdx][p], ca[stripIdx][p + 1], ca[stripIdx][p + 2]],
            [cb[stripIdx][p], cb[stripIdx][p + 1], cb[stripIdx][p + 2]],
          );
          const bottomValue = -0.5 * det3Rows(
            [1, 1, 1],
            [ca[stripIdx + 1][p], ca[stripIdx + 1][p + 1], ca[stripIdx + 1][p + 2]],
            [cb[stripIdx + 1][p], cb[stripIdx + 1][p + 1], cb[stripIdx + 1][p + 2]],
          );
          const localValue = topValue + bottomValue;
          total += localValue;
          pushContribution(pairContributions, {
            kind: "hexa",
            moveType: move.type,
            stripIdx,
            pos: p,
            numericValue: localValue,
          });
        } else if (move.type === "octa") {
          const topValue = cyclicAreaPair(
            [ca[stripIdx][p], ca[stripIdx][p + 1], ca[stripIdx][p + 2], ca[stripIdx][p + 3]],
            [cb[stripIdx][p], cb[stripIdx][p + 1], cb[stripIdx][p + 2], cb[stripIdx][p + 3]],
          );
          const bottomValue = -cyclicAreaPair(
            [ca[stripIdx + 1][p], ca[stripIdx + 1][p + 1], ca[stripIdx + 1][p + 2], ca[stripIdx + 1][p + 3]],
            [cb[stripIdx + 1][p], cb[stripIdx + 1][p + 1], cb[stripIdx + 1][p + 2], cb[stripIdx + 1][p + 3]],
          );
          const localValue = topValue + bottomValue;
          total += localValue;
          pushContribution(pairContributions, {
            kind: "octa",
            moveType: move.type,
            stripIdx,
            pos: p,
            numericValue: localValue,
          });
        }
      });

      const boundaryValue = boundaryIntersection(words[words.length - 1], ca[ca.length - 1], cb[cb.length - 1], datum);
      total += boundaryValue;
      pushContribution(pairContributions, {
        kind: "bottom-boundary",
        numericValue: boundaryValue,
      });
      contributions[a][b] = pairContributions;
      epsilon[a][b] = frozenSet.has(a) && frozenSet.has(b) ? 0 : formatQuiverWeight(total);
    });
  });

  const colors = Object.fromEntries(dashedRays.map((ray) => [ray.label, ray.color]));
  const arrows = [];
  labels.forEach((a) => {
    labels.forEach((b) => {
      if (a === b) return;
      if (frozenSet.has(a) && frozenSet.has(b)) return;
      const rawValue = epsilon[a][b];
      const numericValue = quiverWeightNumeric(rawValue);
      if (numericValue > 0) {
        arrows.push({
          source: a,
          target: b,
          weight: rawValue,
          contributions: contributions[a][b],
        });
      }
    });
  });
  return {
    labels,
    epsilon,
    arrows,
    frozen,
    exchangeable,
    colors,
    contributions,
    ordinaryQuiver: simplyLaced,
    cycleOverlayAvailable: simplyLaced,
    intersectionEvidenceAvailable: simplyLaced,
    symmetrizer: labels.map((label) => {
      const generator = cycleLookup.get(label)?.generator;
      return cartanSymmetrizer(datum)[(generator ?? 1) - 1] ?? 1;
    }),
  };
}

function sourceCoordinateNames(rxwLength, uLength) {
  return [
    ...Array.from({ length: rxwLength }, (_, idx) => `w${idx + 1}`),
    ...Array.from({ length: uLength }, (_, idx) => `z${idx + 1}`),
  ];
}

function computeTopCoordinateRows(topWeave) {
  const rows = [sourceCoordinateNames(topWeave.rxw.length, topWeave.u.length)];
  topWeave.moves.forEach((move, stripIdx) => {
    const row = rows[stripIdx];
    const p = move.pos;
    if (move.type === "tetra") {
      rows.push([
        ...row.slice(0, p),
        row[p + 1],
        row[p],
        ...row.slice(p + 2),
      ]);
      return;
    }
    if (move.type === "hexa") {
      rows.push([
        ...row.slice(0, p),
        row[p + 2],
        subtractExpressions(multiplyExpressions(row[p], row[p + 2]), row[p + 1]),
        row[p],
        ...row.slice(p + 3),
      ]);
      return;
    }
    if (move.type === "octa") {
      rows.push([
        ...row.slice(0, p),
        ...octaTopCoordinateExpressions(row, p, move.longFirst),
        ...row.slice(p + 4),
      ]);
      return;
    }
    throw new Error("The top weave should contain only 4-valent, 6-valent, and 8-valent moves.");
  });
  return rows;
}

function tokenizeForSubstitution(expr) {
  return tokenizeExpression(expr).map((token) => token.value);
}

function substituteExpressionText(expr, substitutions) {
  const tokens = tokenizeForSubstitution(expr);
  return tokens.map((token) => {
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token) && substitutions[token]) {
      return wrapExpression(substitutions[token]);
    }
    return token;
  }).join("");
}

export function expandExpressionText(expr, substitutionsObject = {}) {
  const substitutions = new Map(
    Object.entries(substitutionsObject).map(([name, value]) => [
      name,
      parseRationalExpression(value),
    ]),
  );
  try {
    return formatRational(parseRationalExpression(String(expr ?? ""), substitutions));
  } catch (error) {
    if (!(error instanceof ExpressionExpansionError)) throw error;
    return substituteExpressionText(String(expr ?? ""), substitutionsObject);
  }
}

export function computeFullClusterValues(clusterValues, coordinateSubstitution) {
  const substitutions = new Map(
    Object.entries(coordinateSubstitution).map(([name, expr]) => [
      name,
      parseRationalExpression(expr),
    ]),
  );

  return clusterValues.map((value) => {
    try {
      const whole = parseRationalExpression(value.expression, substitutions);
      return {
        ...value,
        middleExpression: value.expression,
        expression: formatRational(whole),
        substitutionWarning: value.expansionWarning ?? "",
      };
    } catch (error) {
      if (!(error instanceof ExpressionExpansionError)) throw error;
      return {
        ...value,
        middleExpression: value.expression,
        expression: substituteExpressionText(value.expression, coordinateSubstitution),
        substitutionWarning: "The substituted expression is large, so an unsimplified substituted expression is displayed.",
      };
    }
  });
}

function placeholderZRows(words, coordinatePrefix = "y") {
  return words.map((word, rowIdx) => word.map((_, edgeIdx) => `${coordinatePrefix}${rowIdx + 1}_${edgeIdx + 1}`));
}

function placeholderClusterValues(stepInfos) {
  return stepInfos
    .filter((info) => !info.plus)
    .map((info) => ({
      label: info.clusterVariable,
      step: info.step,
      entryLabel: info.entryLabel,
      triMoveIndex: info.triMoveIndex,
      expression: "",
      expansionWarning: "Coordinate formulas are not implemented for this type.",
    }));
}

export function buildDoubleInductiveWeave(doubleString, datum, options = {}) {
  const coordinatePrefix = options.coordinatePrefix ?? "y";
  let words = [[]];
  const moves = [];
  const stepInfos = [];
  let currentElement = identityCoxeterElement(datum);
  let currentReducedWord = [];
  let clusterCount = 0;

  doubleString.forEach((entry, idx) => {
    const step = idx + 1;
    const generator = entry.h;
    const side = entry.side;
    let insertedBottomWord;
    let nextPermutationCandidate;

    if (side === "L") {
      words = words.map((row) => [generator, ...row]);
      moves.forEach((move) => {
        move.pos += 1;
      });
      insertedBottomWord = [generator, ...currentReducedWord];
      nextPermutationCandidate = leftMultiplySimpleReflection(currentElement, generator, datum);
    } else {
      words = words.map((row) => [...row, generator]);
      insertedBottomWord = [...currentReducedWord, generator];
      nextPermutationCandidate = rightMultiplySimpleReflection(currentElement, generator, datum);
    }

    const oldLength = coxeterLength(currentElement, datum);
    const candidateLength = coxeterLength(nextPermutationCandidate, datum);
    const plus = candidateLength === oldLength + 1;

    if (plus) {
      currentElement = nextPermutationCandidate;
      currentReducedWord = insertedBottomWord;
      stepInfos.push({
        step,
        entryLabel: entryLabel(entry),
        generator,
        side,
        plus: true,
        clusterVariable: null,
        triMoveIndex: null,
        bottomReducedWordAfterStep: currentReducedWord.slice(),
      });
      return;
    }

    if (datum.family === "A") {
      const shorter = reducedWordFromCoxeterElement(nextPermutationCandidate, datum);
      const pretriWord = side === "L"
        ? [generator, generator, ...shorter]
        : [...shorter, generator, generator];
      const posttriWord = side === "L"
        ? [generator, ...shorter]
        : [...shorter, generator];
      const triPos = side === "L" ? 0 : shorter.length;
      const path = fastBraidPathBetweenWords(insertedBottomWord, pretriWord, datum);
      for (let pathIdx = 1; pathIdx < path.words.length; pathIdx += 1) {
        words.push(path.words[pathIdx]);
        moves.push({
          ...path.moves[pathIdx - 1],
          sourceStep: step,
          entryLabel: entryLabel(entry),
        });
      }
      words.push(posttriWord);
      moves.push({
        type: "tri",
        pos: triPos,
        sourceStep: step,
        entryLabel: entryLabel(entry),
      });
      const triMoveIndex = moves.length - 1;
      clusterCount += 1;
      currentReducedWord = posttriWord;
      stepInfos.push({
        step,
        entryLabel: entryLabel(entry),
        generator,
        side,
        plus: false,
        clusterVariable: `A${clusterCount}`,
        triMoveIndex,
        bottomReducedWordAfterStep: currentReducedWord.slice(),
      });
      return;
    }

    const path = braidPathToSideDescent(currentReducedWord, generator, side, datum);
    for (let pathIdx = 1; pathIdx < path.words.length; pathIdx += 1) {
      const row = side === "L"
        ? [generator, ...path.words[pathIdx]]
        : [...path.words[pathIdx], generator];
      words.push(row);
      moves.push({
        ...path.moves[pathIdx - 1],
        pos: path.moves[pathIdx - 1].pos + (side === "L" ? 1 : 0),
        sourceStep: step,
        entryLabel: entryLabel(entry),
      });
    }

    const descentWord = path.words[path.words.length - 1];
    const posttriWord = descentWord.slice();
    const triPos = side === "L" ? 0 : descentWord.length - 1;
    words.push(posttriWord);
    moves.push({
      type: "tri",
      pos: triPos,
      sourceStep: step,
      entryLabel: entryLabel(entry),
    });
    const triMoveIndex = moves.length - 1;
    clusterCount += 1;
    currentReducedWord = posttriWord;
    stepInfos.push({
      step,
      entryLabel: entryLabel(entry),
      generator,
      side,
      plus: false,
      clusterVariable: `A${clusterCount}`,
      triMoveIndex,
      bottomReducedWordAfterStep: currentReducedWord.slice(),
    });
  });

  const lusztigCycles = computeAllLusztigCycles(words, moves, stepInfos);
  const uRows = computeURows(words, lusztigCycles);
  const pinning = coordinatePinning(datum);
  const coordinateAvailable = pinning.available && isSimplyLacedDatum(datum);
  const { zRows, dashedRays } = coordinateAvailable
    ? computeZRowsAndDashedRays(pinning, words, moves, uRows, stepInfos, coordinatePrefix)
    : { zRows: placeholderZRows(words, coordinatePrefix), dashedRays: [] };
  const clusterValues = coordinateAvailable
    ? computeClusterValues(words, moves, uRows, zRows, stepInfos)
    : placeholderClusterValues(stepInfos);
  const quiverData = computeQuiverData(words, moves, lusztigCycles, dashedRays, datum);

  return {
    rank: datum.rank,
    dynkin: datum,
    coordinateAvailable,
    pinningInfo: {
      family: pinning.family,
      group: pinning.group,
      label: pinning.label,
      description: pinning.description,
      matrixSize: pinning.matrixSize,
      simpleRoots: pinning.simpleRoots,
    },
    doubleString,
    words,
    moves,
    finalReducedWord: currentReducedWord,
    demazureElement: currentElement,
    stepInfos,
    lusztigCycles,
    uRows,
    zRows,
    dashedRays,
    clusterValues,
    quiverData,
  };
}

export function buildDoubleInductiveWeaveA(doubleString, rank) {
  return buildDoubleInductiveWeave(doubleString, createDynkinDatum({ family: "A", rank }));
}

export function buildTopWeave({ datum, rxw, u, c }) {
  const words = [[...rxw, ...u]];
  const moves = [];
  const stepInfos = [];
  let leftPrefix = [];

  for (let idx = 0; idx < c - 1; idx += 1) {
    const generator = u[idx];
    const starred = datum.star.get(generator);
    const suffix = u.slice(idx + 1);
    const localStart = [...rxw, generator];
    const localTarget = [starred, ...rxw];
    const path = fastBraidPathBetweenWords(localStart, localTarget, datum);

    for (let pathIdx = 1; pathIdx < path.words.length; pathIdx += 1) {
      const move = path.moves[pathIdx - 1];
      moves.push({
        ...move,
        pos: move.pos + leftPrefix.length,
        sourceStep: idx + 1,
        entryLabel: `${generator}->${starred}`,
      });
      words.push([...leftPrefix, ...path.words[pathIdx], ...suffix]);
    }

    leftPrefix = [...leftPrefix, starred];
    stepInfos.push({
      sourceStep: idx + 1,
      generator,
      starred,
      targetPrefix: leftPrefix.slice(),
    });
  }

  const topWeave = {
    rank: datum.rank,
    dynkin: datum,
    rxw: rxw.slice(),
    u: u.slice(),
    c,
    words,
    moves,
    stepInfos,
    sourceWord: [...rxw, ...u],
    targetWord: words[words.length - 1].slice(),
  };
  const coordinateRows = computeTopCoordinateRows(topWeave);
  topWeave.coordinateRows = coordinateRows;
  topWeave.coordinateSubstitution = Object.fromEntries(
    coordinateRows[coordinateRows.length - 1].map((expr, idx) => [`y${idx + 1}`, expr]),
  );
  topWeave.sourceCoordinates = coordinateRows[0].slice();
  return topWeave;
}

export function buildTopWeaveA({ rank, rxw, u, c }) {
  return buildTopWeave({ datum: createDynkinDatum({ family: "A", rank }), rxw, u, c });
}
