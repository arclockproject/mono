import { parseTerms, type RawTerm, SearchError } from "./parse";
import type { SearchOptions, SearchTerm } from "./types";

const SAFE_NAME: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * The checked column settings of one table or view.
 */
type Resolver = {
  /** Lowercase column names and aliases, mapped to the real column name. Excluded columns are left out. */
  names: Map<string, string>;
  /** Real names of the columns checked for free-text keys. */
  search: string[];
};

/**
 * Checks column settings and prepares them for looking up names from the search text.
 *
 * @param options The column settings.
 * @returns The checked settings.
 * @throws {SearchError} If a column name is unsafe, or `search` or `alias` use a column or name
 * that can't be used.
 */
function createResolver(
  options: Pick<
    SearchOptions<string>,
    "columns" | "exclude" | "search" | "alias"
  >,
): Resolver {
  const excluded = new Set<string>(options.exclude ?? []);
  const names = new Map<string, string>();
  for (const column of options.columns) {
    if (!SAFE_NAME.test(column)) {
      throw new SearchError(`Column name "${column}" is not allowed.`);
    }
    if (!excluded.has(column)) names.set(column.toLowerCase(), column);
  }
  for (const [column, aliases] of Object.entries(options.alias ?? {}) as [
    string,
    readonly string[] | undefined,
  ][]) {
    if (!names.has(column.toLowerCase())) {
      throw new SearchError(`Alias target "${column}" is not a usable column.`);
    }
    for (const alias of aliases ?? []) {
      const key = alias.toLowerCase();
      if (names.has(key) && names.get(key) !== column) {
        throw new SearchError(`Alias "${alias}" is already used.`);
      }
      names.set(key, column);
    }
  }
  const search = (options.search ?? []).map((column) => {
    const name = names.get(column.toLowerCase());
    if (name === undefined || excluded.has(name)) {
      throw new SearchError(
        `Search column "${column}" is not a usable column.`,
      );
    }
    return name;
  });
  return { names, search };
}

/**
 * Checks the length of the search text, splits it into terms, and checks the number of terms.
 *
 * @param text The search text.
 * @param limits `maxLength` and `maxTerms`, with their defaults of 500 and 20.
 * @returns The terms as written.
 * @throws {SearchError} If the text is too long, has too many terms, or can't be read.
 */
function readTerms(
  text: string,
  limits: { maxLength?: number; maxTerms?: number },
): RawTerm[] {
  const maxLength = limits.maxLength ?? 500;
  const maxTerms = limits.maxTerms ?? 20;
  if (text.length > maxLength) {
    throw new SearchError(
      `The search is too long. Use at most ${maxLength} characters.`,
    );
  }
  const raw = parseTerms(text);
  if (raw.length > maxTerms) {
    throw new SearchError(
      `The search has too many parts. Use at most ${maxTerms}.`,
    );
  }
  return raw;
}

/**
 * Looks up a term's column in one table.
 *
 * @param resolver The table's checked settings.
 * @param raw The term as written.
 * @returns The term with its real column name, or `undefined` if the table has no such column,
 * or has no `search` columns for a free-text key.
 */
function resolveTerm(resolver: Resolver, raw: RawTerm): SearchTerm | undefined {
  let column: string | undefined;
  if (raw.name === undefined) {
    if (resolver.search.length === 0) return undefined;
  } else {
    column = resolver.names.get(raw.name.toLowerCase());
    if (column === undefined) return undefined;
  }
  return {
    column,
    operator: raw.operator,
    value: raw.value,
    negate: raw.negate,
    start: raw.start,
    end: raw.end,
  };
}

/**
 * The error for a term no table can use.
 *
 * @param raw The term as written.
 * @returns A {@link SearchError} pointing at the term.
 */
function unusableTerm(raw: RawTerm): SearchError {
  return raw.name === undefined
    ? new SearchError(
        `Free-text search is not available. Use column=value instead of "${raw.value}".`,
        raw.position,
      )
    : new SearchError(`Unknown column "${raw.name}".`, raw.position);
}

/**
 * Says if a term matches rows where its column has no value: `-` terms and `!=`, but not `-x!=y`.
 *
 * @param term The term.
 * @returns `true` if a missing value counts as a match.
 */
function matchesMissing(term: {
  operator: SearchTerm["operator"];
  negate: boolean;
}): boolean {
  return term.negate !== (term.operator === "!=");
}

export type { Resolver };
export {
  createResolver,
  matchesMissing,
  readTerms,
  resolveTerm,
  SAFE_NAME,
  unusableTerm,
};
