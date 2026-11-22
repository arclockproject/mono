import { createSelect, createUnion } from "./build";
import { SearchError } from "./parse";
import { RANDOM } from "./sql";
import type {
  SearchBuilder,
  SearchBuildInput,
  SearchDialect,
  SearchFilter,
  SearchOptions,
  SearchSelectOptions,
  SearchSortOptions,
  SearchSQL,
  SearchUnionOptions,
  SearchUnionSource,
} from "./types";

function selectSearch<
  const Column extends string,
  const Sort extends string = never,
  Context = undefined,
>(options: SearchSelectOptions<Column, Sort, Context>): SearchBuilder<Context> {
  return createSelect(options);
}

function unionSearch<
  const Output extends string,
  const Source extends string,
  const Sort extends string = never,
  Context = undefined,
>(
  options: SearchUnionOptions<Output, Source, Sort, Context>,
): SearchBuilder<Context> {
  return createUnion(options);
}

/**
 * Turns search text from a user into a full SQL query, with sorting and paging. Define a search
 * once with `select` (one table) or `union` (several tables). For each request, call `build`, run
 * its `text` and `params` on your database, and pass the rows to `result`.
 *
 * Paging with the `next` and `prev` cursors from `result` shows every row exactly once, in one
 * fixed order, even while rows are added or removed. Only a row whose sort value changes while
 * someone pages can move. Jumping with `page` uses `OFFSET`, which is exact while nothing changes.
 *
 * The search text is split on spaces. Each part must match, and can be:
 *
 * - `key` or `"two words"`: one of the `search` columns contains it.
 * - `^key`, `key$`, `^key$`: it is at the start, at the end, or is the whole value.
 * - `column=value`, also `!=`, `>`, `<`, `>=` (or `=>`), `<=` (or `=<`): compares one column.
 *   For `>`, `<`, `>=` and `<=`, number values are sent as numbers.
 * - `column:value`: the column contains the value. `^` and `$` work here too.
 * - `-` before any part: it must not match.
 *
 * An empty (`NULL`) column never matches. So `-key`, `-column=value` and `column!=value` keep
 * rows where the column is `NULL`, and `column=value` or `key` leave them out.
 *
 * A `\` makes the next character plain, e.g. `\^`, `\$` or `\"`. Values from the request are
 * always sent as parameters, and column names come only from the settings.
 *
 * @see {@link https://arclockproject.org/docs/common/library/Search Guide} | {@link https://arclockproject.org/docs/api/common/library/Search API}
 */
const Search: {
  select: typeof selectSearch;
  union: typeof unionSearch;
  random: typeof RANDOM;
} = {
  /**
   * Defines a search on one table, view or subquery, with a fixed filter, sorting and paging.
   *
   * @param options The search, filter, sort and page settings.
   * @returns A builder with `build`, which gives the SQL and a `result` function for the rows.
   * @throws {SearchError} If the settings can't be used.
   * @example
   * const users = Search.select({ from: "users", columns: ["id", "username", "bio"], search: ["bio"], sort: { name: "username" }, tieBreak: ["id"], pageSize: 20 });
   * const query = users.build({ text: "cat", page: 2 });
   * query.text; // "SELECT `id`, `username`, `bio` FROM users WHERE (`bio` LIKE ? ESCAPE '!') ORDER BY `username` DESC, `id` DESC LIMIT ? OFFSET ?"
   * query.params; // ["%cat%", 21, 20]
   */
  select: selectSearch,
  /**
   * Defines one search over several tables, joined with `UNION ALL`, with sorting and paging.
   * Every table gives the same `output` columns, and the pages are the same as if all tables
   * were one table.
   *
   * Each table has its own columns. A term on a column only some tables have leaves the other
   * tables out, or is skipped for them if it matches missing values (`-` terms and `!=`).
   * A column no table has is an error.
   *
   * @param options The output columns, tables, and sort and page settings.
   * @returns A builder with `build`, which gives the SQL and a `result` function for the rows.
   * @throws {SearchError} If the settings can't be used.
   * @example
   * const media = Search.union({ output: ["kind", "id", "title"], sourceColumn: "kind", tieBreak: ["kind", "id"], sources: { song: { from: "songs", columns: ["id", "title"], search: ["title"] }, film: { from: "films", columns: ["id", "title", "year"], search: ["title"] } } });
   * media.build({ text: "year>2000" }).sources; // ["film"]
   */
  union: unionSearch,
  /**
   * A `sort` value for random order. Each row's place comes from a hash of the seed and its
   * `tieBreak` values, so the same seed always gives the same order and pages never overlap.
   * Works with MySQL, MariaDB and Postgres, not SQLite.
   */
  random: RANDOM,
};

export default Search;
export { SearchError };
export type {
  SearchBuilder,
  SearchBuildInput,
  SearchDialect,
  SearchFilter,
  SearchOptions,
  SearchSelectOptions,
  SearchSortOptions,
  SearchSQL,
  SearchUnionOptions,
  SearchUnionSource,
};
