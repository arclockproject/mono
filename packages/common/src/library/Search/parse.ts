import type { SearchOperator } from "./types";

/**
 * Thrown for search text or settings that can't be used. `status` is `400`, so Express answers
 * with "400 Bad Request" when the error is passed to `next`.
 */
class SearchError extends Error {
  /** HTTP status for this error. Express reads it when the error is passed to `next`. */
  status: number = 400;
  /**
   * Creates the error.
   *
   * @param message What is wrong, written for the person who typed the search.
   * @param position Index in the search text where the problem is, if it is in the text.
   */
  constructor(
    message: string,
    public position?: number,
  ) {
    super(message);
    this.name = "SearchError";
  }
}

/**
 * A term as written, before column names are checked.
 */
type RawTerm = {
  /** The column name as typed, or `undefined` for a free-text key. */
  name?: string;
  /** The operator, with `=>` and `=<` already turned into `>=` and `<=`. */
  operator: SearchOperator;
  /** The value, without quotes, escapes, or `^`/`$` anchors. */
  value: string;
  /** `true` if the value had an unescaped `^` at the start. */
  start: boolean;
  /** `true` if the value had an unescaped `$` at the end. */
  end: boolean;
  /** `true` if the term started with `-`. */
  negate: boolean;
  /** Index of the term in the search text. */
  position: number;
};

const COLUMN = /([A-Za-z_][A-Za-z0-9_]*)(>=|<=|=>|=<|!=|=|>|<|:)/y;
const OPERATORS: { [written: string]: SearchOperator } = {
  "=>": ">=",
  "=<": "<=",
};

/**
 * Reads a value at `index`: a quoted string, or text up to the next space. A `\` makes the next
 * character plain, so `\"`, `\^`, `\$` and `\ ` can be used.
 *
 * @param text The search text.
 * @param index Where the value starts.
 * @returns The value, its anchors, and the index after it.
 */
function readValue(
  text: string,
  index: number,
): { value: string; start: boolean; end: boolean; next: number } {
  const quoted = text[index] === '"';
  let i = quoted ? index + 1 : index;
  const chars: { char: string; escaped: boolean }[] = [];
  let closed = !quoted;
  while (i < text.length) {
    const char = text[i] as string;
    if (char === "\\" && i + 1 < text.length) {
      chars.push({ char: text[i + 1] as string, escaped: true });
      i += 2;
      continue;
    }
    if (quoted && char === '"') {
      closed = true;
      i++;
      break;
    }
    if (!quoted && /\s/.test(char)) break;
    chars.push({ char, escaped: false });
    i++;
  }
  if (!closed) throw new SearchError("A quote is not closed.", index);
  const first = chars[0];
  const start = first !== undefined && !first.escaped && first.char === "^";
  if (start) chars.shift();
  const last = chars[chars.length - 1];
  const end = last !== undefined && !last.escaped && last.char === "$";
  if (end) chars.pop();
  return { value: chars.map((c) => c.char).join(""), start, end, next: i };
}

/**
 * Splits search text into terms. Column names are not checked here.
 *
 * @param text The search text.
 * @returns The terms in the order they were written.
 * @throws {SearchError} If a quote is not closed or a column term has no value.
 */
function parseTerms(text: string): RawTerm[] {
  const terms: RawTerm[] = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i] as string)) {
      i++;
      continue;
    }
    const position = i;
    let negate = false;
    if (
      text[i] === "-" &&
      i + 1 < text.length &&
      !/\s/.test(text[i + 1] as string)
    ) {
      negate = true;
      i++;
    }
    let name: string | undefined;
    let operator: SearchOperator = ":";
    if (text[i] !== '"') {
      COLUMN.lastIndex = i;
      const match = COLUMN.exec(text);
      if (match) {
        name = match[1] as string;
        const written = match[2] as string;
        operator = OPERATORS[written] ?? (written as SearchOperator);
        i += match[0].length;
        if (i >= text.length || /\s/.test(text[i] as string)) {
          throw new SearchError(`"${name}" needs a value.`, position);
        }
      }
    }
    const read = readValue(text, i);
    i = read.next;
    const anchors = operator === ":";
    terms.push({
      name,
      operator,
      value: anchors
        ? read.value
        : `${read.start ? "^" : ""}${read.value}${read.end ? "$" : ""}`,
      start: anchors && read.start,
      end: anchors && read.end,
      negate,
      position,
    });
  }
  return terms;
}

export type { RawTerm };
export { parseTerms, SearchError };
