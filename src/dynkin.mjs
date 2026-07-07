function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

export function normalizeDynkinFamily(value = "A") {
  const family = String(value ?? "A").trim().toUpperCase();
  if (!["A", "B", "C", "D", "E"].includes(family)) {
    throw new Error(`Dynkin type must be A, B, C, D, or E.`);
  }
  return family;
}

function dynkinEdges(family, rank) {
  if (family === "A") {
    return Array.from({ length: Math.max(rank - 1, 0) }, (_, idx) => [idx + 1, idx + 2]);
  }
  if (family === "D") {
    if (rank < 4) throw new Error("Type D_n requires n >= 4.");
    const edges = [];
    for (let i = 1; i <= rank - 3; i += 1) edges.push([i, i + 1]);
    edges.push([rank - 2, rank - 1], [rank - 2, rank]);
    return edges;
  }
  if (family === "B") {
    if (rank < 2) throw new Error("Type B_n requires n >= 2.");
    return Array.from({ length: rank - 1 }, (_, idx) => [idx + 1, idx + 2]);
  }
  if (family === "C") {
    if (rank < 2) throw new Error("Type C_n requires n >= 2.");
    return Array.from({ length: rank - 1 }, (_, idx) => [idx + 1, idx + 2]);
  }
  if (rank < 6 || rank > 8) throw new Error("Type E_n requires n = 6, 7, or 8.");
  const edges = [[1, 3], [3, 4], [2, 4]];
  for (let i = 4; i < rank; i += 1) edges.push([i, i + 1]);
  return edges;
}

function cartanMatrix(family, rank, edges) {
  const cartan = Array.from({ length: rank }, (_, row) => (
    Array.from({ length: rank }, (_, col) => (row === col ? 2 : 0))
  ));
  edges.forEach(([a, b]) => {
    cartan[a - 1][b - 1] = -1;
    cartan[b - 1][a - 1] = -1;
  });
  if (family === "B") {
    cartan[rank - 2][rank - 1] = -2;
    cartan[rank - 1][rank - 2] = -1;
  }
  if (family === "C") {
    cartan[rank - 2][rank - 1] = -1;
    cartan[rank - 1][rank - 2] = -2;
  }
  return cartan;
}

function basisVector(rank, index) {
  const out = Array(rank).fill(0);
  out[index - 1] = 1;
  return out;
}

function vectorKey(vector) {
  return vector.join(",");
}

function reflectVector(vector, generator, cartan) {
  const out = vector.slice();
  const idx = generator - 1;
  let pairing = 0;
  for (let col = 0; col < vector.length; col += 1) {
    pairing += cartan[idx][col] * vector[col];
  }
  out[idx] -= pairing;
  return out;
}

function isPositiveRoot(vector) {
  return vector.some((entry) => entry > 0) && vector.every((entry) => entry >= 0);
}

function isNegativeRoot(vector) {
  return vector.some((entry) => entry < 0) && vector.every((entry) => entry <= 0);
}

function enumeratePositiveRoots(rank, cartan) {
  const queue = Array.from({ length: rank }, (_, idx) => basisVector(rank, idx + 1));
  const seen = new Map(queue.map((root) => [vectorKey(root), root]));
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const root = queue[cursor];
    for (let generator = 1; generator <= rank; generator += 1) {
      const reflected = reflectVector(root, generator, cartan);
      const key = vectorKey(reflected);
      if (seen.has(key)) continue;
      seen.set(key, reflected);
      queue.push(reflected);
    }
  }
  return [...seen.values()].filter(isPositiveRoot);
}

export function identityCoxeterElement(datum) {
  return Array.from({ length: datum.rank }, (_, idx) => basisVector(datum.rank, idx + 1));
}

function applyElementToVector(element, vector) {
  const out = Array(vector.length).fill(0);
  vector.forEach((coefficient, idx) => {
    if (coefficient === 0) return;
    element[idx].forEach((entry, row) => {
      out[row] += coefficient * entry;
    });
  });
  return out;
}

export function rightMultiplySimpleReflection(element, generator, datum) {
  const idx = generator - 1;
  const image = element[idx];
  return element.map((column, colIdx) => {
    const coefficient = datum.cartan[idx][colIdx];
    if (coefficient === 0) return column.slice();
    return column.map((entry, row) => entry - coefficient * image[row]);
  });
}

export function leftMultiplySimpleReflection(element, generator, datum) {
  return element.map((column) => reflectVector(column, generator, datum.cartan));
}

export function coxeterLength(element, datum) {
  return datum.positiveRoots.filter((root) => isNegativeRoot(applyElementToVector(element, root))).length;
}

function elementKey(element) {
  return element.map(vectorKey).join("|");
}

function computeW0Word(datum, chooseIndex = 0) {
  let element = identityCoxeterElement(datum);
  const word = [];
  const targetLength = datum.positiveRoots.length;
  while (word.length < targetLength) {
    const candidates = [];
    for (let generator = 1; generator <= datum.rank; generator += 1) {
      if (isPositiveRoot(element[generator - 1])) candidates.push(generator);
    }
    if (candidates.length === 0) throw new Error(`Could not construct a reduced word for w_0 in type ${datum.label}.`);
    const generator = candidates[Math.min(chooseIndex, candidates.length - 1)];
    word.push(generator);
    element = rightMultiplySimpleReflection(element, generator, datum);
  }
  return { word, element };
}

function computeStarMap(datum, w0Element) {
  const star = new Map();
  for (let i = 1; i <= datum.rank; i += 1) {
    const image = w0Element[i - 1];
    const target = image.findIndex((entry, idx) => entry === -1 && image.every((value, j) => j === idx || value === 0));
    if (target < 0) throw new Error(`Could not compute i* for type ${datum.label}.`);
    star.set(i, target + 1);
  }
  return star;
}

export function createDynkinDatum({ family = "A", rank }) {
  const normalizedFamily = normalizeDynkinFamily(family);
  assertPositiveInteger(rank, "rank");
  const edges = dynkinEdges(normalizedFamily, rank);
  const cartan = cartanMatrix(normalizedFamily, rank, edges);
  const adjacency = new Map(Array.from({ length: rank }, (_, idx) => [idx + 1, []]));
  edges.forEach(([a, b]) => {
    adjacency.get(a).push(b);
    adjacency.get(b).push(a);
  });
  adjacency.forEach((neighbors) => neighbors.sort((a, b) => a - b));
  const datum = {
    family: normalizedFamily,
    rank,
    label: `${normalizedFamily}_${rank}`,
    edges,
    cartan,
    adjacency,
    positiveRoots: enumeratePositiveRoots(rank, cartan),
  };
  const { word, element } = computeW0Word(datum, 0);
  datum.standardHalfTwistWord = word;
  datum.star = computeStarMap(datum, element);
  return datum;
}

export function randomHalfTwistWordForDatum(datum) {
  let element = identityCoxeterElement(datum);
  const word = [];
  const targetLength = datum.positiveRoots.length;
  while (word.length < targetLength) {
    const candidates = [];
    for (let generator = 1; generator <= datum.rank; generator += 1) {
      if (isPositiveRoot(element[generator - 1])) candidates.push(generator);
    }
    if (candidates.length === 0) throw new Error(`Could not construct a random reduced word for w_0 in type ${datum.label}.`);
    const generator = candidates[Math.floor(Math.random() * candidates.length)];
    word.push(generator);
    element = rightMultiplySimpleReflection(element, generator, datum);
  }
  return word;
}

export function reducedWordFromCoxeterElement(element, datum) {
  let current = element.map((column) => column.slice());
  const word = [];
  while (coxeterLength(current, datum) > 0) {
    let found = false;
    for (let generator = 1; generator <= datum.rank; generator += 1) {
      if (!isNegativeRoot(current[generator - 1])) continue;
      current = rightMultiplySimpleReflection(current, generator, datum);
      word.push(generator);
      found = true;
      break;
    }
    if (!found) throw new Error(`Could not reduce a Coxeter element in type ${datum.label}.`);
  }
  return word.reverse();
}

export function validateSequenceInDynkin(sequence, datum, name) {
  sequence.forEach((entry) => {
    if (!Number.isInteger(entry) || entry < 1 || entry > datum.rank) {
      throw new Error(`${name} contains ${entry}, which is outside type ${datum.label}.`);
    }
  });
}

export function areAdjacent(datum, left, right) {
  return datum.adjacency.get(left)?.includes(right) ?? false;
}
