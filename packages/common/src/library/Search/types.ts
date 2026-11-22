import type { RANDOM } from "./sql";

/**
 * Which SQL flavour to write. It sets how column names are quoted and how parameters are written.
 *
 * - `"mysql"`: `` `name` `` and `?`.
 * - `"sqlite"`: `"name"` and `?`.
 * - `"postgres"`: `"name"` and `$1`, `$2`, ….
 */
type SearchDialect = "mysql" | "sqlite" | "postgres";

/**
 * How a column term compares its value.
 *
 * - `"="`, `"!="`, `">"`, `"<"`, `">="`, `"<="`: compare with the value. `=>` and `=<` in the
 *   search text are read as `>=` and `<=`.
 * - `":"`: the column contains the value, like a free-text key but on one column. `^` and `$` work.
 */
type SearchOperator = "=" | "!=" | ">" | "<" | ">=" | "<=" | ":";

/**
 * One parsed part of the search text.
 */
type SearchTerm = {
  /**
   * The column it is checked on, by its real name (aliases are resolved).
   * `undefined` for a free-text key, which is checked on every `search` column.
   */
  column?: string;
  /** How the value is compared. `":"` for free-text keys. */
  operator: SearchOperator;
  /** The value, without quotes, escapes or `^`/`$`. */
  value: string;
  /** `true` if the term started with `-`. The term must then not match. */
  negate: boolean;
  /** `true` if the value started with `^`: it must be at the start. Only for `":"`. */
  start: boolean;
  /** `true` if the value ended with `$`: it must be at the end. Only for `":"`. */
  end: boolean;
};

/**
 * Settings for a search on one table or view. Column names are checked when the settings are
 * first used, and must be letters, digits and `_`, not starting with a digit.
 */
type SearchOptions<Column extends string> = {
  /**
   * Every column the search text may use. Any other column name in the text is an error.
   */
  columns: readonly Column[];
  /**
   * Columns removed from `columns`, e.g. `password`. The search text can't use them, and the
   * error message is the same as for a column that does not exist. They are not selected unless
   * `fields` or a union's `select` asks for them.
   */
  exclude?: readonly Column[];
  /**
   * Columns checked for free-text keys like `key1` or `"two words"`. A key matches if any of
   * these columns contains it. Without this, free-text keys are an error.
   */
  search?: readonly Column[];
  /**
   * Other names the search text may use for a column, e.g. `{ description: ["desc"] }` lets
   * `desc=hello` mean `description=hello`. Names are matched without case.
   */
  alias?: { readonly [name in Column]?: readonly string[] };
  /**
   * The SQL flavour to write.
   *
   * @default "mysql"
   */
  dialect?: SearchDialect;
  /**
   * The number of the first placeholder, for `"postgres"`. Set it when `where` comes after other
   * parameters in the query.
   *
   * @default 1
   */
  paramStart?: number;
  /**
   * The most terms one search text can have.
   *
   * @default 20
   */
  maxTerms?: number;
  /**
   * The longest search text allowed, in characters.
   *
   * @default 500
   */
  maxLength?: number;
};

/**
 * A fixed SQL condition added to a search, written by you. Search text never goes in it.
 *
 * Either SQL text, or a function that builds it. The function is called on every `build`, so it
 * can use request data through `param`, e.g. `` (param, req) => `owner_id = ${param(req.userID)}` ``.
 *
 * Use it for rows that must never be returned. It is joined with the search as
 * `WHERE (filter) AND (search)`, so the search text can only narrow it. Empty SQL throws an
 * error instead of searching every row.
 *
 * @param param Adds a value as a parameter and gives its placeholder.
 * @param context The `context` passed to `build`.
 */
type SearchFilter<Context> =
  | string
  | ((param: (value: SearchValue) => string, context: Context) => string);

/**
 * A value sent to the database as a parameter.
 */
type SearchValue = string | number | bigint | boolean | Date | null;

/**
 * Sorting and paging settings for {@link SearchBuilder}s.
 *
 * Rows are always in one fixed order: the chosen sort column, then the `tieBreak` columns, all in
 * the same direction. `NULL` values are placed where the database puts them (first when going up
 * in MySQL and SQLite, last in Postgres). Paging with `after` and `before` shows every row once,
 * even while rows are added or removed.
 */
type SearchSortOptions<Sort extends string, Key extends string> = {
  /**
   * Sort names the request may ask for, mapped to the column to sort by, or to `Search.random`.
   * In a union, the column is an `output` column. In a select, it is one of `columns`.
   * For fast pages, index each table on the sort column followed by the `tieBreak` columns.
   */
  sort?: { readonly [name in Sort]: NoInfer<Key> | typeof RANDOM };
  /**
   * Sort used when the request asks for none, or for one not in `sort`.
   *
   * @default The first name in `sort`.
   */
  defaultSort?: NoInfer<Sort>;
  /**
   * Order used when the request asks for neither `"asc"` nor `"desc"`. Random order ignores it.
   *
   * @default "desc"
   */
  defaultOrder?: "asc" | "desc";
  /**
   * Columns that together are different for every row, e.g. `["id"]`, or `["service", "id"]` in a
   * union. They are sorted after the sort column, and decide the random order too. Without a
   * unique set, rows with the same values can swap places between pages.
   */
  tieBreak: readonly NoInfer<Key>[];
  /**
   * Rows per page.
   *
   * @default 50
   */
  pageSize?: number;
  /** The highest page number `page` may ask for. Larger numbers are lowered to this. */
  maxPage?: number;
};

/**
 * Settings for {@link Search.select}: a search on one table, view or subquery, with sorting and paging.
 */
type SearchSelectOptions<
  Column extends string,
  Sort extends string,
  Context,
> = SearchOptions<Column> &
  SearchSortOptions<Sort, Column> & {
    /**
     * What to select from, as SQL written by you, e.g. `"users"` or `"(SELECT …) AS u"`.
     */
    from: string;
    /**
     * The selected fields, as SQL written by you. Leave it out to select only `columns` without
     * `exclude`. With your own SQL here, make sure it doesn't select anything that must stay
     * private, and that it selects the `sort` and `tieBreak` columns by name.
     *
     * @default the usable columns, e.g. "`username`, `bio`"
     */
    fields?: string;
    /** A fixed condition every row must also match. See {@link SearchFilter}. */
    filter?: SearchFilter<Context>;
  };

/**
 * One table in a {@link Search.union}.
 */
type SearchUnionSource<Output extends string, Context> = Pick<
  SearchOptions<string>,
  "columns" | "exclude" | "search" | "alias"
> & {
  /** What to select from, as SQL written by you, e.g. `"books"` or `"(SELECT …) AS p"`. */
  from: string;
  /**
   * SQL for `output` columns, written by you, e.g. `{ published: "published_date" }`.
   * An `output` column not listed here is taken from the column with the same name if it is in
   * `columns` and not excluded, and is `NULL` otherwise.
   */
  select?: { readonly [name in Output]?: string };
  /** A fixed condition every row of this table must also match. See {@link SearchFilter}. */
  filter?: SearchFilter<Context>;
};

/**
 * Settings for {@link Search.union}: one search over several tables, joined with `UNION ALL`.
 * Pages are the same as if all tables were one table.
 */
type SearchUnionOptions<
  Output extends string,
  Source extends string,
  Sort extends string,
  Context,
> = Pick<
  SearchOptions<string>,
  "dialect" | "paramStart" | "maxTerms" | "maxLength"
> &
  SearchSortOptions<Sort, Output> & {
    /**
     * The columns every row has, in order. Names must be letters, digits and `_`, and can't start
     * with `_search_`.
     */
    output: readonly Output[];
    /**
     * An `output` column filled with the name of the table the row came from, e.g. `"service"`.
     * When set, it must be in `tieBreak`, because ids can repeat across tables.
     */
    sourceColumn?: NoInfer<Output>;
    /**
     * The tables, by name. Names must be letters, digits and `_`.
     *
     * A term on a column only some tables have leaves the other tables out. If the term matches
     * missing values (`-` terms and `!=`), it is skipped for those tables instead. A column no
     * table has is an error.
     */
    sources: { readonly [name in Source]: SearchUnionSource<Output, Context> };
  };

/**
 * What a request asks for. Values are read loosely, so `req.query` values can be passed as they are.
 */
type SearchBuildInput<Context> = {
  /** The search text. Missing means no search. Anything else that is not a string is an error. */
  text?: unknown;
  /**
   * For a union: the tables to search, as an array or a comma-separated string. Unknown names
   * are ignored. Missing means all tables.
   */
  sources?: unknown;
  /** A name from `sort`. Anything else uses `defaultSort`. */
  sort?: unknown;
  /** `"asc"` or `"desc"`, in any case. Anything else uses `defaultOrder`. */
  order?: unknown;
  /**
   * Seed for random sorting, a whole number. Without one, a new seed is picked and returned as
   * `seed` by `result`. A cursor keeps its own seed.
   */
  seed?: unknown;
  /**
   * The page number, from 1, for jumping to a page. Anything that is not a number of at least 1
   * means page 1. Not used when `after` or `before` is set.
   */
  page?: unknown;
  /** The `next` cursor of the page before. Gives the page after it. */
  after?: unknown;
  /** The `prev` cursor of the page after. Gives the page before it. Not used when `after` is set. */
  before?: unknown;
  /** Passed to `filter` functions. */
  context?: Context;
};

/**
 * One page of results, from {@link SearchSQL.result}.
 */
type SearchPage<Row> = {
  /** The rows of this page, in order. */
  rows: Row[];
  /**
   * The page number. After `after` or `before`, it is counted from the page the cursor came from,
   * so it can be off if rows were added or removed earlier in the order.
   */
  page: number;
  /** Pass as `after` to get the next page. `null` on the last page. */
  next: string | null;
  /** Pass as `before` to get the page before. `null` on the first page. */
  prev: string | null;
  /** The seed of a random order. Pass it as `seed` when jumping to a page. */
  seed?: number;
};

/**
 * A full query, ready to run.
 */
type SearchSQL = {
  /** The SQL. */
  text: string;
  /** Values for the placeholders in `text`, in order. */
  params: SearchValue[];
  /** For a union: the tables that are searched. Empty if none can match. */
  sources: string[];
  /**
   * Turns the rows the database returned into a page with `next` and `prev` cursors. The query
   * asks for one extra row to know if there is a next page, and `result` drops it.
   *
   * @param rows The rows returned for `text`.
   * @returns The page.
   * @throws {Error} If a row is missing a `sort` or `tieBreak` column.
   */
  result: <Row extends object>(rows: readonly Row[]) => SearchPage<Row>;
};

/**
 * Builds a full query from what a request asks for.
 */
type SearchBuilder<Context> = {
  /**
   * Builds the query.
   *
   * @param input What the request asks for.
   * @returns The SQL and its parameters.
   * @throws {SearchError} If the search text or a cursor can't be used.
   */
  build: (input: SearchBuildInput<Context>) => SearchSQL;
};

export type {
  SearchBuilder,
  SearchBuildInput,
  SearchDialect,
  SearchFilter,
  SearchOperator,
  SearchOptions,
  SearchPage,
  SearchSelectOptions,
  SearchSortOptions,
  SearchSQL,
  SearchTerm,
  SearchUnionOptions,
  SearchUnionSource,
  SearchValue,
};
