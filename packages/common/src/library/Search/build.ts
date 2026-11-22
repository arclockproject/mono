import {
  afterCondition,
  type Cursor,
  type Direction,
  decodeCursor,
  encodeCursor,
  fingerprint,
  RANDOM_COLUMN,
  randomExpression,
} from "./paging";
import { SearchError } from "./parse";
import { Params, quote, RANDOM, termsCondition } from "./sql";
import {
  createResolver,
  matchesMissing,
  readTerms,
  resolveTerm,
  SAFE_NAME,
  unusableTerm,
} from "./terms";
import type {
  SearchBuilder,
  SearchBuildInput,
  SearchDialect,
  SearchFilter,
  SearchPage,
  SearchSelectOptions,
  SearchSortOptions,
  SearchSQL,
  SearchTerm,
  SearchUnionOptions,
} from "./types";

/**
 * Reads the search text from a request value.
 *
 * @param value The value.
 * @returns The text, or `""` for a missing value.
 * @throws {SearchError} If the value is something other than a string.
 */
function readText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new SearchError("The search must be text.");
  }
  return value;
}

/**
 * Reads a whole number from a request value.
 *
 * @param value The value.
 * @returns The number, or `undefined` if it is not a safe whole number.
 */
function readInteger(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
}

/**
 * Checks that a setting is a whole number of at least 1.
 *
 * @param name The setting's name, for the error message.
 * @param value The setting.
 * @throws {SearchError} If it is set and is not a whole number of at least 1.
 */
function checkPositive(name: string, value: number | undefined): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
    throw new SearchError(`${name} must be a whole number of at least 1.`);
  }
}

/**
 * Reads a list of names from an array or a comma-separated string.
 *
 * @param value The value.
 * @returns The names, or `undefined` if the value is missing or not a list.
 */
function readList(value: unknown): string[] | undefined {
  const items = typeof value === "string" ? [value] : value;
  if (!Array.isArray(items)) return undefined;
  return items
    .filter((item): item is string => typeof item === "string")
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Builds a filter's SQL.
 *
 * @param filter The filter, if any.
 * @param params Where the filter's values go.
 * @param context The `context` passed to `build`.
 * @returns The SQL, or `""` without a filter.
 * @throws {Error} If a filter gives no SQL, so a broken filter never shows every row.
 */
function filterSQL<Context>(
  filter: SearchFilter<Context> | undefined,
  params: Params,
  context: Context,
): string {
  if (filter === undefined) return "";
  const sql = typeof filter === "string" ? filter : filter(params.add, context);
  if (typeof sql !== "string" || sql.trim() === "") {
    throw new Error(
      'A search filter gave no SQL. Return a condition like "1 = 1" to allow every row.',
    );
  }
  return sql;
}

/**
 * Joins conditions into a `WHERE` clause.
 *
 * @param conditions The conditions. Empty ones are skipped.
 * @returns ` WHERE (a) AND (b)`, or `""` when there are none.
 */
function whereClause(conditions: string[]): string {
  const used = conditions.filter(Boolean);
  return used.length === 0 ? "" : ` WHERE (${used.join(") AND (")})`;
}

/**
 * How one request is sorted and paged.
 */
type Plan = {
  /** `"page"` for a page number, `"after"` or `"before"` for a cursor. */
  mode: "page" | "after" | "before";
  /** The page number to report. */
  page: number;
  /** Rows to skip, for `"page"`. */
  offset: number;
  /** Rows per page. */
  limit: number;
  /** Column names of the sort keys, in order. */
  names: string[];
  /** Direction of each key in the query. Flipped for `"before"`. */
  directions: Direction[];
  /** The cursor's values, for `"after"` and `"before"`. */
  values?: Cursor["values"];
  /** The seed, for a random order. */
  seed?: number;
  /** Fingerprint of the search, sort and order. */
  fingerprint: string;
};

/**
 * Checks the sort settings and gives a function that plans sorting and paging for one request.
 *
 * @param options The sort settings.
 * @param dialect The SQL flavour.
 * @param columns The column names keys may use.
 * @param last A tie-break column to compare last, e.g. a union's source column. It is the same
 * for every row of one table, so putting it last lets each table use its index on the other keys.
 * @returns The planning function. Its `search` argument is what the fingerprint is made from.
 * @throws {SearchError} If the settings can't be used.
 */
function createPaging<Sort extends string, Key extends string>(
  options: SearchSortOptions<Sort, Key>,
  dialect: SearchDialect,
  columns: ReadonlySet<string>,
  last?: string,
): (input: SearchBuildInput<unknown>, search: unknown) => Plan {
  const sorts = (options.sort ?? {}) as {
    [name: string]: string | typeof RANDOM;
  };
  const names = Object.keys(sorts);
  const defaultSort = options.defaultSort ?? names[0];
  if (defaultSort !== undefined && !Object.hasOwn(sorts, defaultSort)) {
    throw new SearchError(`Default sort "${defaultSort}" is not in sort.`);
  }
  for (const [name, column] of Object.entries(sorts)) {
    if (column === RANDOM) {
      if (dialect === "sqlite") {
        throw new SearchError("Random sorting is not available for SQLite.");
      }
    } else if (!columns.has(column)) {
      throw new SearchError(
        `Sort "${name}" uses "${column}", which is not a usable column.`,
      );
    }
  }
  const given = [...new Set<string>(options.tieBreak ?? [])];
  const tieBreak =
    last !== undefined && given.includes(last)
      ? [...given.filter((column) => column !== last), last]
      : given;
  if (tieBreak.length === 0) {
    throw new SearchError("tieBreak needs at least one column, e.g. the id.");
  }
  for (const column of tieBreak) {
    if (!columns.has(column)) {
      throw new SearchError(
        `tieBreak uses "${column}", which is not a usable column.`,
      );
    }
  }
  checkPositive("pageSize", options.pageSize);
  checkPositive("maxPage", options.maxPage);
  const limit = options.pageSize ?? 50;
  const maxPage = Math.min(
    options.maxPage ?? Number.MAX_SAFE_INTEGER,
    Math.floor((Number.MAX_SAFE_INTEGER - 1) / limit) - 1,
  );

  return (input, search) => {
    const name =
      typeof input.sort === "string" && Object.hasOwn(sorts, input.sort)
        ? input.sort
        : defaultSort;
    const sort = name === undefined ? undefined : sorts[name];
    const random = sort === RANDOM;
    const asked =
      typeof input.order === "string" ? input.order.toLowerCase() : undefined;
    const order: Direction = random
      ? "ASC"
      : ((asked === "asc" || asked === "desc"
          ? asked
          : (options.defaultOrder ?? "desc")
        ).toUpperCase() as Direction);
    const keys = random
      ? [RANDOM_COLUMN, ...tieBreak]
      : [
          ...(typeof sort === "string" ? [sort] : []),
          ...tieBreak.filter((column) => column !== sort),
        ];
    const print = fingerprint(JSON.stringify([search, name ?? "", order]));
    const after = input.after !== undefined && input.after !== "";
    const before = !after && input.before !== undefined && input.before !== "";

    if (after || before) {
      const cursor = decodeCursor(
        after ? input.after : input.before,
        keys.length,
      );
      if (cursor.fingerprint !== print) {
        throw new SearchError(
          "This page link is for a different search. Start again from the first page.",
        );
      }
      if (random && cursor.seed === undefined) {
        throw new SearchError("This page link is not valid.");
      }
      const flip: Direction = order === "ASC" ? "DESC" : "ASC";
      return {
        mode: after ? "after" : "before",
        page: after ? cursor.page + 1 : Math.max(1, cursor.page - 1),
        offset: 0,
        limit,
        names: keys,
        directions: keys.map(() => (before ? flip : order)),
        values: cursor.values,
        seed: random ? cursor.seed : undefined,
        fingerprint: print,
      };
    }
    const page = Math.min(Math.max(1, readInteger(input.page) ?? 1), maxPage);
    return {
      mode: "page",
      page,
      offset: (page - 1) * limit,
      limit,
      names: keys,
      directions: keys.map(() => order),
      seed: random
        ? (readInteger(input.seed) ?? Math.floor(Math.random() * 2 ** 31))
        : undefined,
      fingerprint: print,
    };
  };
}

/**
 * Turns the rows of a query into a page with cursors.
 *
 * @param plan How the query was sorted and paged.
 * @param rows The rows the database returned, with one extra row if there are more.
 * @returns The page.
 */
function toPage<Row extends object>(
  plan: Plan,
  rows: readonly Row[],
): SearchPage<Row> {
  const more = rows.length > plan.limit;
  const list = rows.slice(0, plan.limit);
  if (plan.mode === "before") list.reverse();
  const hasNext = plan.mode === "before" || more;
  const hasPrev =
    plan.mode === "before" ? more : plan.mode === "after" || plan.page > 1;
  const cursor = {
    fingerprint: plan.fingerprint,
    page: plan.page,
    seed: plan.seed,
  };
  const first = list[0];
  const last = list[list.length - 1];
  const next =
    hasNext && last !== undefined
      ? encodeCursor(last, plan.names, cursor)
      : null;
  const prev =
    hasPrev && first !== undefined
      ? encodeCursor(first, plan.names, cursor)
      : null;
  const clean =
    plan.seed === undefined
      ? list
      : list.map((row) => {
          const { [RANDOM_COLUMN]: _, ...rest } = row as {
            [column: string]: unknown;
          };
          return rest as Row;
        });
  return {
    rows: clean,
    page: plan.page,
    next,
    prev,
    ...(plan.seed === undefined ? {} : { seed: plan.seed }),
  };
}

/**
 * Writes `ORDER BY` for the plan's keys.
 *
 * @param plan The plan.
 * @param dialect The SQL flavour, for quoting.
 * @returns ` ORDER BY a DESC, b DESC`.
 */
function orderClause(
  plan: Plan,
  dialect: SearchDialect,
  skip?: string,
): string {
  return ` ORDER BY ${plan.names
    .map((name, i) =>
      name === skip ? "" : `${quote(dialect, name)} ${plan.directions[i]}`,
    )
    .filter(Boolean)
    .join(", ")}`;
}

/**
 * Creates the builder for {@link Search.select}.
 *
 * @param options The settings.
 * @returns The builder.
 * @throws {SearchError} If the settings can't be used.
 */
function createSelect<Column extends string, Sort extends string, Context>(
  options: SearchSelectOptions<Column, Sort, Context>,
): SearchBuilder<Context> {
  const dialect = options.dialect ?? "mysql";
  const resolver = createResolver(options);
  const usable = new Set(resolver.names.values());
  for (const column of usable) {
    if (column.startsWith("_search_")) {
      throw new SearchError(
        `Column names can't start with "_search_": "${column}".`,
      );
    }
  }
  const plan = createPaging(options, dialect, usable);
  const fields =
    options.fields ??
    [...usable].map((column) => quote(dialect, column)).join(", ");
  if (fields === "") throw new SearchError("No columns to select.");
  const tieBreak = [...new Set<string>(options.tieBreak)];

  return {
    build: (input) => {
      const raw = readTerms(readText(input.text), options);
      const terms = raw.map((r) => {
        const term = resolveTerm(resolver, r);
        if (!term) throw unusableTerm(r);
        return term;
      });
      const paging = plan(input, readText(input.text));
      const params = new Params(dialect, options.paramStart);
      const hash = () =>
        randomExpression(
          dialect,
          () => params.add(String(paging.seed)),
          tieBreak.map((c) => quote(dialect, c)),
        );
      const key = (name: string) => () =>
        name === RANDOM_COLUMN ? hash() : quote(dialect, name);
      const select =
        paging.seed === undefined
          ? fields
          : `${fields}, ${hash()} AS ${quote(dialect, RANDOM_COLUMN)}`;
      const where = whereClause([
        filterSQL(options.filter, params, input.context as Context),
        termsCondition(terms, resolver.search, params),
        paging.values
          ? afterCondition(
              paging.names.map(key),
              paging.directions,
              paging.values,
              params,
            )
          : "",
      ]);
      const order = orderClause(paging, dialect);
      const limit = ` LIMIT ${params.add(paging.limit + 1)}${paging.mode === "page" ? ` OFFSET ${params.add(paging.offset)}` : ""}`;
      return {
        text: `SELECT ${select} FROM ${options.from}${where}${order}${limit}`,
        params: params.values,
        sources: [],
        result: (rows) => toPage(paging, rows),
      } satisfies SearchSQL;
    },
  };
}

/**
 * Creates the builder for {@link Search.union}.
 *
 * Each table gives only the rows that can be on the page, in the page's order, and the outer
 * query sorts those. The pages are the same as if all tables were one table.
 *
 * @param options The settings.
 * @returns The builder.
 * @throws {SearchError} If the settings can't be used.
 */
function createUnion<
  Output extends string,
  Source extends string,
  Sort extends string,
  Context,
>(
  options: SearchUnionOptions<Output, Source, Sort, Context>,
): SearchBuilder<Context> {
  const dialect = options.dialect ?? "mysql";
  for (const name of options.output) {
    if (!SAFE_NAME.test(name)) {
      throw new SearchError(`Output column name "${name}" is not allowed.`);
    }
    if (name.startsWith("_search_")) {
      throw new SearchError(
        `Output column names can't start with "_search_": "${name}".`,
      );
    }
  }
  const outputs = new Set<string>(options.output);
  if (options.sourceColumn !== undefined) {
    if (!outputs.has(options.sourceColumn)) {
      throw new SearchError(
        `Source column "${options.sourceColumn}" is not in output.`,
      );
    }
    if (
      !(options.tieBreak as readonly string[]).includes(options.sourceColumn)
    ) {
      throw new SearchError(
        `tieBreak must include the source column "${options.sourceColumn}", because ids can repeat across tables.`,
      );
    }
  }
  const plan = createPaging(options, dialect, outputs, options.sourceColumn);
  const tieBreak = [...new Set<string>(options.tieBreak)];
  const sources = (
    Object.entries(options.sources) as [
      string,
      SearchUnionOptions<Output, Source, Sort, Context>["sources"][Source],
    ][]
  ).map(([name, source]) => {
    if (!SAFE_NAME.test(name)) {
      throw new SearchError(`Source name "${name}" is not allowed.`);
    }
    for (const key of Object.keys(source.select ?? {})) {
      if (!outputs.has(key)) {
        throw new SearchError(
          `Source "${name}" selects "${key}", which is not in output.`,
        );
      }
    }
    const resolver = createResolver(source);
    const usable = new Set(resolver.names.values());
    const expressions = new Map<string, string>(
      options.output.map((column) => [
        column,
        column === options.sourceColumn
          ? `'${name}'`
          : (source.select?.[column] ??
            (usable.has(column) ? quote(dialect, column) : "NULL")),
      ]),
    );
    const fields = options.output
      .map(
        (column) => `${expressions.get(column)} AS ${quote(dialect, column)}`,
      )
      .join(", ");
    return { name, source, resolver, expressions, fields };
  });
  if (sources.length === 0) throw new SearchError("No sources are set.");

  return {
    build: (input) => {
      const text = readText(input.text);
      const raw = readTerms(text, options);
      const resolved = sources.map((s) =>
        raw.map((r) => resolveTerm(s.resolver, r)),
      );
      raw.forEach((r, i) => {
        if (resolved.every((terms) => terms[i] === undefined)) {
          throw unusableTerm(r);
        }
      });
      const asked = readList(input.sources);
      const paging = plan(input, [
        text,
        asked ? [...new Set(asked)].sort() : "*",
      ]);
      const params = new Params(dialect, options.paramStart);
      const randomAs = (s: (typeof sources)[number]) =>
        paging.seed === undefined
          ? ""
          : `, ${randomExpression(
              dialect,
              () => params.add(String(paging.seed)),
              tieBreak.map((c) => s.expressions.get(c) as string),
            )} AS ${quote(dialect, RANDOM_COLUMN)}`;
      const partLimit = paging.offset + paging.limit + 1;
      const parts: string[] = [];
      const used: string[] = [];
      sources.forEach((s, index) => {
        if (asked && !asked.includes(s.name)) return;
        const terms: SearchTerm[] = [];
        for (const [i, r] of raw.entries()) {
          const term = resolved[index]?.[i];
          if (term) terms.push(term);
          else if (!matchesMissing(r)) return;
        }
        const select = `${s.fields}${randomAs(s)}`;
        const key = (name: string) => () =>
          name === RANDOM_COLUMN
            ? randomExpression(
                dialect,
                () => params.add(String(paging.seed)),
                tieBreak.map((c) => s.expressions.get(c) as string),
              )
            : (s.expressions.get(name) as string);
        const where = whereClause([
          filterSQL(s.source.filter, params, input.context as Context),
          termsCondition(terms, s.resolver.search, params),
          paging.values
            ? afterCondition(
                paging.names.map(key),
                paging.directions,
                paging.values,
                params,
              )
            : "",
        ]);
        const order = orderClause(paging, dialect, options.sourceColumn);
        parts.push(
          `SELECT * FROM (SELECT ${select} FROM ${s.source.from}${where}${order} LIMIT ${params.add(partLimit)}) AS ${quote(dialect, `_search_${s.name}`)}`,
        );
        used.push(s.name);
      });
      if (parts.length === 0) {
        const first = sources[0] as (typeof sources)[number];
        const random =
          paging.seed === undefined
            ? ""
            : `, NULL AS ${quote(dialect, RANDOM_COLUMN)}`;
        parts.push(
          `SELECT * FROM (SELECT ${first.fields}${random} FROM ${first.source.from} WHERE 1 = 0) AS ${quote(dialect, "_search_none")}`,
        );
      }
      const order = orderClause(paging, dialect);
      const limit = ` LIMIT ${params.add(paging.limit + 1)}${paging.mode === "page" ? ` OFFSET ${params.add(paging.offset)}` : ""}`;
      return {
        text: `SELECT * FROM (${parts.join(" UNION ALL ")}) AS ${quote(dialect, "_search_results")}${order}${limit}`,
        params: params.values,
        sources: used,
        result: (rows) => toPage(paging, rows),
      } satisfies SearchSQL;
    },
  };
}

export { createSelect, createUnion };
