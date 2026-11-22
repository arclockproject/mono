import { matchesMissing } from "./terms";
import type {
  SearchDialect,
  SearchOperator,
  SearchTerm,
  SearchValue,
} from "./types";

/**
 * Use as a `sort` value to sort in random order. The same seed always gives the same order.
 */
const RANDOM: unique symbol = Symbol("random");

const NUMBER = /^-?\d+(\.\d+)?$/;
const SQL_OPERATORS: { [operator in SearchOperator]: string } = {
  "=": "=",
  "!=": "=",
  ">": ">",
  "<": "<",
  ">=": ">=",
  "<=": "<=",
  ":": "LIKE",
};

/**
 * Collects parameter values in the order their placeholders appear in the SQL.
 */
class Params {
  /** The values, in placeholder order. */
  values: SearchValue[] = [];
  /**
   * Creates an empty list.
   *
   * @param dialect Sets the placeholder style.
   * @param start Number of the first `$n` placeholder for `"postgres"`.
   */
  constructor(
    public dialect: SearchDialect,
    public start: number = 1,
  ) {}
  /**
   * Adds a value.
   *
   * @param value The value.
   * @returns The placeholder to put in the SQL.
   */
  add = (value: SearchValue): string => {
    this.values.push(value);
    return this.dialect === "postgres"
      ? `$${this.start + this.values.length - 1}`
      : "?";
  };
}

/**
 * Quotes a column name. The name must already be checked to be safe.
 *
 * @param dialect Sets the quote character.
 * @param name The column name.
 * @returns The quoted name.
 */
function quote(dialect: SearchDialect, name: string): string {
  return dialect === "mysql" ? `\`${name}\`` : `"${name}"`;
}

/**
 * Turns a value into a `LIKE` pattern, with `!` as the escape character.
 *
 * @param term The value and its anchors.
 * @returns The pattern.
 */
function likePattern(term: {
  value: string;
  start: boolean;
  end: boolean;
}): string {
  return `${term.start ? "" : "%"}${term.value.replace(/[!%_]/g, "!$&")}${term.end ? "" : "%"}`;
}

/**
 * Builds the SQL condition for one term.
 *
 * @param term The term, with its real column name.
 * @param search Real names of the columns checked for free-text keys.
 * @param params Where the values go.
 * @returns The condition.
 */
function termCondition(
  term: SearchTerm,
  search: readonly string[],
  params: Params,
): string {
  const { dialect } = params;
  const text = (column: string) => {
    const quoted =
      dialect === "postgres"
        ? `${quote(dialect, column)}::text`
        : quote(dialect, column);
    return term.negate ? `COALESCE(${quoted}, '')` : quoted;
  };
  if (term.column === undefined || term.operator === ":") {
    const columns = term.column === undefined ? search : [term.column];
    const pattern = likePattern(term);
    const parts = columns.map(
      (c) => `${text(c)} LIKE ${params.add(pattern)} ESCAPE '!'`,
    );
    const condition = parts.join(" OR ");
    if (term.negate) return `NOT (${condition})`;
    return parts.length === 1 ? condition : `(${condition})`;
  }
  const numeric =
    term.operator !== "=" && term.operator !== "!=" && NUMBER.test(term.value);
  const condition = `${quote(dialect, term.column)} ${SQL_OPERATORS[term.operator]} ${params.add(numeric ? Number(term.value) : term.value)}`;
  return matchesMissing(term) ? `(${condition}) IS NOT TRUE` : condition;
}

/**
 * Builds the condition for all terms. Every term must match.
 *
 * @param terms The terms, with their real column names.
 * @param search Real names of the columns checked for free-text keys.
 * @param params Where the values go.
 * @returns The condition, or `""` when there are no terms.
 */
function termsCondition(
  terms: readonly SearchTerm[],
  search: readonly string[],
  params: Params,
): string {
  return terms.map((term) => termCondition(term, search, params)).join(" AND ");
}

export { Params, quote, RANDOM, termsCondition };
