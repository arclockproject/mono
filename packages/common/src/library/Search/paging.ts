import { SearchError } from "./parse";
import type { Params } from "./sql";
import type { SearchDialect, SearchValue } from "./types";

/**
 * Name of the extra column that holds a row's random position. It is removed by `result`.
 */
const RANDOM_COLUMN = "_search_random";

/**
 * Sort direction of one key.
 */
type Direction = "ASC" | "DESC";

/**
 * What a cursor stores.
 */
type Cursor = {
  /** Fingerprint of the search, sort and order it belongs to. */
  fingerprint: string;
  /** The page number the cursor was made on. */
  page: number;
  /** The row's values of every sort key, in key order. */
  values: SearchValue[];
  /** The seed of a random order. */
  seed?: number;
};

/**
 * Says if the database puts `NULL` before every other value when sorting up.
 *
 * @param dialect The SQL flavour.
 * @returns `true` for MySQL and SQLite, `false` for Postgres.
 */
function nullsLow(dialect: SearchDialect): boolean {
  return dialect !== "postgres";
}

/**
 * Says if `NULL` values come after other values when going in `direction`.
 *
 * @param dialect The SQL flavour.
 * @param direction The direction.
 * @returns `true` if `NULL`s come last.
 */
function nullsAfter(dialect: SearchDialect, direction: Direction): boolean {
  return (direction === "ASC") !== nullsLow(dialect);
}

/**
 * Writes the condition for rows that come strictly after a cursor in the given order.
 * `NULL` values are placed where the database sorts them, so this matches `ORDER BY` exactly.
 *
 * Every part is written in reading order, so `?` placeholders get their values in the right order.
 * Each key is a function that writes its SQL, so a key with its own parameters (the random hash)
 * gets fresh placeholders every time it appears.
 *
 * @param keys A function per key that writes its SQL, as usable in `WHERE`.
 * @param directions Direction of each key.
 * @param values The cursor's value for each key.
 * @param params Where the values go.
 * @returns The condition.
 */
function afterCondition(
  keys: readonly (() => string)[],
  directions: readonly Direction[],
  values: readonly SearchValue[],
  params: Params,
): string {
  const { dialect } = params;
  const equal = (key: () => string, value: SearchValue) => {
    const sql = key();
    return value === null ? `${sql} IS NULL` : `${sql} = ${params.add(value)}`;
  };
  const beyond = (
    key: () => string,
    direction: Direction,
    value: SearchValue,
    orEqual: boolean,
  ): string | undefined => {
    const last = nullsAfter(dialect, direction);
    if (value === null) {
      if (orEqual) return last ? `${key()} IS NULL` : undefined;
      return last ? undefined : `${key()} IS NOT NULL`;
    }
    const operator = `${direction === "ASC" ? ">" : "<"}${orEqual ? "=" : ""}`;
    const compare = `${key()} ${operator} ${params.add(value)}`;
    return last ? `(${compare} OR ${key()} IS NULL)` : compare;
  };
  const strictAt = keys.map((_, j) =>
    values[j] === null && nullsAfter(dialect, directions[j] as Direction)
      ? undefined
      : j,
  );
  if (strictAt.every((j) => j === undefined)) return "1 = 0";

  const parts: string[] = [];
  const bound = beyond(
    keys[0] as () => string,
    directions[0] as Direction,
    values[0] as SearchValue,
    true,
  );
  if (bound) parts.push(bound);
  const terms: string[] = [];
  for (const j of strictAt) {
    if (j === undefined) continue;
    const conditions = keys
      .slice(0, j)
      .map((key, i) => equal(key, values[i] as SearchValue));
    conditions.push(
      beyond(
        keys[j] as () => string,
        directions[j] as Direction,
        values[j] as SearchValue,
        false,
      ) as string,
    );
    terms.push(conditions.join(" AND "));
  }
  parts.push(
    terms.length === 1 ? (terms[0] as string) : `(${terms.join(" OR ")})`,
  );
  return parts.join(" AND ");
}

/**
 * Writes the SQL that gives each row its random position: a hash of the seed and the row's
 * tie-break values. The same seed always gives the same order.
 *
 * @param dialect The SQL flavour.
 * @param seed Adds the seed as a parameter and gives its placeholder.
 * @param expressions SQL for each tie-break column.
 * @returns The SQL.
 * @throws {SearchError} For SQLite, which has no hash function.
 */
function randomExpression(
  dialect: SearchDialect,
  seed: () => string,
  expressions: readonly string[],
): string {
  if (dialect === "mysql") {
    return `CRC32(CONCAT_WS(',', ${seed()}, ${expressions.join(", ")}))`;
  }
  if (dialect === "postgres") {
    return `md5(concat_ws(',', ${seed()}::text, ${expressions.map((e) => `(${e})::text`).join(", ")}))`;
  }
  throw new SearchError("Random sorting is not available for SQLite.");
}

/**
 * Makes a short fingerprint of a string, so a cursor can be matched to its search.
 *
 * @param text The string.
 * @returns 8 hex characters.
 */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Turns a row value into something JSON can hold.
 *
 * @param value The value from the database.
 * @param column The column name, for the error message.
 * @returns The value for the cursor.
 * @throws {Error} For values that can't be stored, like binary data.
 */
function encodeValue(value: unknown, column: string): unknown {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value === "bigint") return { b: value.toString() };
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return { d: value.getTime() };
  }
  throw new Error(
    `Search can't page by column "${column}": its values can't be stored in a cursor.`,
  );
}

/**
 * Reads a value stored by {@link encodeValue}.
 *
 * @param value The stored value.
 * @returns The value, or `undefined` if it is not valid.
 */
function decodeValue(value: unknown): SearchValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value === "object") {
    const { b, d } = value as { b?: unknown; d?: unknown };
    if (typeof b === "string" && /^-?\d+$/.test(b)) return BigInt(b);
    if (typeof d === "number" && Number.isFinite(d)) return new Date(d);
  }
  return undefined;
}

/**
 * Makes a cursor string from a row.
 *
 * @param row The row.
 * @param names The sort key column names, in key order.
 * @param cursor The fingerprint, page and seed to store.
 * @returns The cursor, safe to put in a URL.
 */
function encodeCursor(
  row: object,
  names: readonly string[],
  cursor: Omit<Cursor, "values">,
): string {
  const record = row as { [column: string]: unknown };
  const values = names.map((name) => {
    if (!(name in record)) {
      throw new Error(`Search can't page: the rows have no "${name}" column.`);
    }
    return encodeValue(record[name], name);
  });
  const json = JSON.stringify({
    f: cursor.fingerprint,
    p: cursor.page,
    k: values,
    s: cursor.seed,
  });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Reads a cursor string.
 *
 * @param text The cursor from the request.
 * @param keys How many sort keys the cursor must have.
 * @returns The cursor.
 * @throws {SearchError} If the cursor is not valid.
 */
function decodeCursor(text: unknown, keys: number): Cursor {
  const invalid = new SearchError("This page link is not valid.");
  if (typeof text !== "string" || text.length > 4000) throw invalid;
  let data: { f?: unknown; p?: unknown; k?: unknown; s?: unknown };
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw invalid;
  }
  if (
    typeof data !== "object" ||
    data === null ||
    typeof data.f !== "string" ||
    !Number.isSafeInteger(data.p) ||
    (data.p as number) < 1 ||
    !Array.isArray(data.k) ||
    data.k.length !== keys ||
    (data.s !== undefined && !Number.isSafeInteger(data.s))
  ) {
    throw invalid;
  }
  const values = data.k.map(decodeValue);
  if (values.some((v) => v === undefined)) throw invalid;
  return {
    fingerprint: data.f,
    page: data.p as number,
    values: values as SearchValue[],
    seed: data.s as number | undefined,
  };
}

export type { Cursor, Direction };
export {
  afterCondition,
  decodeCursor,
  encodeCursor,
  fingerprint,
  RANDOM_COLUMN,
  randomExpression,
};
