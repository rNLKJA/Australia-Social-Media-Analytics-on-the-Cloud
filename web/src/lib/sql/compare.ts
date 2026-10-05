/**
 * Execution match for the text-to-SQL benchmark. A model's result matches the
 * gold result when, for some assignment of the gold columns to distinct
 * columns of the model's result (extra columns are allowed, names are
 * ignored), the two results contain the same bag of rows: row order is not
 * scored, integers must be equal, other numbers equal within 0.006 (or one
 * part in a million for large values), text equal ignoring case and
 * surrounding space.
 */

export type Cell = string | number | null;

export interface ResultSet {
  columns: string[];
  rows: Cell[][];
}

export function cellsEqual(gold: Cell, cand: Cell): boolean {
  if (gold === null || cand === null) return gold === cand;
  const gNum = typeof gold === "number" ? gold : Number.NaN;
  const cNum =
    typeof cand === "number"
      ? cand
      : typeof cand === "string" && cand.trim() !== ""
        ? Number(cand)
        : Number.NaN;
  if (typeof gold === "number") {
    if (!Number.isFinite(cNum)) return false;
    if (Number.isInteger(gNum)) return Math.abs(cNum - gNum) < 1e-9;
    return Math.abs(cNum - gNum) <= Math.max(0.006, 1e-6 * Math.abs(gNum));
  }
  return String(gold).trim().toLowerCase() === String(cand).trim().toLowerCase();
}

function bagsEqual(gold: Cell[][], cand: Cell[][]): boolean {
  if (gold.length !== cand.length) return false;
  const used = new Array<boolean>(cand.length).fill(false);
  for (const g of gold) {
    const j = cand.findIndex((c, k) => !used[k] && c.every((v, i) => cellsEqual(g[i], v)));
    if (j < 0) return false;
    used[j] = true;
  }
  return true;
}

/** All injective assignments of `k` gold columns to `m` candidate columns. */
function* assignments(k: number, m: number, prefix: number[] = []): Generator<number[]> {
  if (prefix.length === k) {
    yield prefix;
    return;
  }
  for (let j = 0; j < m; j++) if (!prefix.includes(j)) yield* assignments(k, m, [...prefix, j]);
}

export interface MatchResult {
  match: boolean;
  reason: string;
}

export function resultsMatch(gold: ResultSet, cand: ResultSet): MatchResult {
  const k = gold.columns.length;
  const m = cand.columns.length;
  if (m < k) return { match: false, reason: `expected at least ${k} column(s), got ${m}` };
  if (gold.rows.length !== cand.rows.length)
    return { match: false, reason: `expected ${gold.rows.length} row(s), got ${cand.rows.length}` };
  if (m > 10) return { match: false, reason: "too many columns to score" };
  for (const map of assignments(k, m)) {
    const projected = cand.rows.map((r) => map.map((j) => r[j]));
    if (bagsEqual(gold.rows, projected)) return { match: true, reason: "same rows" };
  }
  return { match: false, reason: "different values" };
}
