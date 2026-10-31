/**
 * Turns `Section`s into one MDX page. Exports are `##` headings and their methods are `###` headings.
 *
 * Every section and method follows the same order: code, description, details
 * (params, props, …), examples, then methods. How each kind fills those parts is set in `KINDS`.
 */
import type { Doc, Fn, Member, Prop, Section } from "./types";

type Ids = Map<Section | Member, string>;
type Block = string | false | null | undefined;

type KindRenderer<S extends Section> = {
  /** Shown in italics under the heading. `link` links to another section by name. */
  label: (s: S, link: (name: string) => string) => string;
  /** Code block at the top. */
  code?: (s: S) => string | null;
  /** Blocks after the description, e.g. "Props". Empty ones are dropped. */
  details?: (s: S) => Block[];
  /** Shown as `###` sections after this one. */
  members?: (s: S) => Member[];
};

/** How each kind of section is rendered. TypeScript makes sure every kind has an entry. */
const KINDS: { [K in Section["kind"]]: KindRenderer<Extract<Section, { kind: K }>> } = {
  function: { label: () => "Function", code: (s) => s.fn.signatures.join("\n"), details: (s) => fnDetails(s.fn) },
  component: {
    label: () => "Component",
    details: (s) => [s.typeParams && `**Type parameters** ${code(s.typeParams)}`, renderProps("Props", s.props, s.inherits)],
  },
  namespace: { label: () => "Object", members: (s) => s.members },
  object: { label: () => "Object", details: (s) => [renderProps("Properties", s.props, [])] },
  class: {
    label: () => "Class",
    code: (s) => s.header,
    details: (s) => [
      s.ctor && `**Constructor**\n\n${fence(s.ctor.signatures.join("\n"))}`,
      s.ctor?.doc.description && escapeMdx(s.ctor.doc.description),
      s.ctor && s.ctor.params.length > 0 && renderList("Parameters", s.ctor.params),
      s.props.length > 0 && renderProps("Properties", s.props, []),
    ],
    members: (s) => s.members,
  },
  instance: { label: (s, link) => `Instance of ${link(s.className)}` },
  variable: { label: () => "Constant", code: (s) => s.signature },
  type: {
    label: (s) => (s.internal ? "Type · not exported, used by the API above" : "Type"),
    code: (s) => s.code ?? s.header,
    details: (s) => [s.props.length > 0 && renderProps("Properties", s.props, [])],
  },
};

const kindOf = (s: Section) => KINDS[s.kind] as KindRenderer<Section>;

export function renderPage(
  sections: Section[],
  page: {
    title: string;
    sourceLabel: string;
    importPath: string;
    /** Relative link to the hand-written page for this module. */
    guideLink?: string;
  },
): string {
  const ids = assignIds(sections);
  const importLine = renderImport(sections, page.importPath);
  const link = (name: string) => {
    const target = sections.find((s) => s.name === name);
    return target ? `[\`${name}\`](#${ids.get(target)})` : code(name);
  };
  const blocks = [
    `---\ntitle: ${JSON.stringify(page.title)}\n---`,
    `{/* Generated from ${page.sourceLabel} by plugins/api-docs. Edit the JSDoc there, not this file. */}`,
    importLine && fence(importLine),
    page.guideLink && `For examples and live demos, see the [${page.title} guide](${page.guideLink}).`,
    sections.length === 0 && "This module has no documented exports.",
    ...sections.flatMap((s) => {
      const kind = kindOf(s);
      const label = [kind.label(s, link), s.isDefault && "default export"].filter(Boolean).join(" · ");
      return [
        `## ${s.kind === "function" ? `${s.name}()` : s.name} {#${ids.get(s)}}`,
        `_${label}_`,
        ...renderBody(s.doc, kind.code?.(s) ?? null, kind.details?.(s) ?? []),
        ...members(s).flatMap((m) => [`### ${m.owner}.${m.name}() {#${ids.get(m)}}`, ...renderFn(m.fn)]),
      ];
    }),
  ];
  return `${blocks.filter(Boolean).join("\n\n")}\n`;
}

/** e.g. `import MMD, { MMDLoadDetails, type MMDTemplateEntry } from "@arclockproject/mmd-player";` */
function renderImport(sections: Section[], importPath: string): string | null {
  const exported = sections.filter((s) => !(s.kind === "type" && s.internal));
  const defaultExport = exported.find((s) => s.isDefault)?.name;
  const named = exported.filter((s) => !s.isDefault).map((s) => (s.kind === "type" ? `type ${s.name}` : s.name));
  const parts = [defaultExport, named.length > 0 && `{ ${named.join(", ")} }`].filter(Boolean);
  return parts.length > 0 ? `import ${parts.join(", ")} from "${importPath}";` : null;
}

const members = (s: Section): Member[] => kindOf(s).members?.(s) ?? [];

/**
 * Exports get the id `kebab(name)` and members get `kebab(member)`, e.g.
 * `#time-since`. If a member's id is already taken on the page, it becomes
 * `kebab(owner)-kebab(member)` instead, e.g. `#node2d-distance`.
 */
function assignIds(sections: Section[]): Ids {
  const ids: Ids = new Map(sections.map((s) => [s, kebab(s.name)]));
  const all = [...ids.values(), ...sections.flatMap((s) => members(s).map((m) => kebab(m.name)))];
  for (const s of sections) {
    for (const m of members(s)) {
      const id = kebab(m.name);
      ids.set(m, all.indexOf(id) === all.lastIndexOf(id) ? id : `${ids.get(s)}-${id}`);
    }
  }
  return ids;
}

const renderFn = (fn: Fn): string[] => renderBody(fn.doc, fn.signatures.join("\n"), fnDetails(fn));

function fnDetails(fn: Fn): string[] {
  const blocks = fn.params.length > 0 ? [renderList("Parameters", fn.params)] : [];
  if (fn.doc.returns !== null || (fn.returnType && fn.returnType !== "void")) {
    const type = fn.returnType ? ` ${code(fn.returnType)}` : "";
    const desc = fn.doc.returns ? ` — ${indent(escapeMdx(fn.doc.returns))}` : "";
    blocks.push(`**Returns**${type}${desc}`);
  }
  return blocks;
}

/** Code, deprecation notice, description, details, examples and links, in that order. Empty blocks are dropped. */
function renderBody(doc: Doc, codeBlock: string | null, details: Block[]): string[] {
  const examples = doc.examples.map((e) => (e.includes("```") ? e : fence(e))); // Like VS Code: unfenced examples are code.
  return [
    codeBlock && fence(codeBlock),
    doc.deprecated !== null && `:::warning[Deprecated]\n\n${escapeMdx(doc.deprecated)}\n\n:::`,
    doc.description && escapeMdx(doc.description),
    ...details,
    examples.length > 0 && `**${examples.length > 1 ? "Examples" : "Example"}**\n\n${examples.join("\n\n")}`,
    doc.see.length > 0 && `**See also** ${doc.see.map(escapeMdx).join(", ")}`,
  ].filter((b): b is string => !!b);
}

/** A prop list, then "Also accepts all props of …" for `inherits`. */
function renderProps(title: string, props: Prop[], inherits: string[]): string {
  const lines = props.length > 0 ? [propList(props, "")] : [];
  if (inherits.length > 0) {
    lines.push(`${props.length > 0 ? "Also accepts" : "Accepts"} all props of ${inherits.map(code).join(" and ")}.`);
  }
  return `**${title}**\n\n${lines.length > 0 ? lines.join("\n\n") : "None."}`;
}

const renderList = (title: string, props: Prop[]) => `**${title}**\n\n${propList(props, "")}`;

/** e.g. "- `speed?` (`number`, default `100`) — Milliseconds per character.", with nested fields indented. */
function propList(props: Prop[], pad: string): string {
  const inner = `${pad}  `;
  const item = (p: Prop) => {
    const name = `${p.isStatic ? "static " : ""}${p.readonly ? "readonly " : ""}${p.name}${p.optional ? "?" : ""}`;
    const defaultValue = p.doc.defaultValue || p.defaultValue;
    const details = [p.type && code(p.type), defaultValue && `default ${code(defaultValue)}`].filter(Boolean);
    return [
      `${pad}- ${code(name)}${details.length > 0 ? ` (${details.join(", ")})` : ""}` +
        `${p.doc.deprecated !== null ? " **Deprecated.**" : ""}` +
        `${p.doc.description ? ` — ${indent(escapeMdx(p.doc.description), inner)}` : ""}`,
      // Callback props can document their own `@param` and `@returns`.
      ...[...p.doc.params].map(([param, text]) => `${inner}- ${code(param)}${text ? ` — ${escapeMdx(text)}` : ""}`),
      p.doc.returns && `${inner}- Returns ${escapeMdx(p.doc.returns)}`,
      p.children.length > 0 && propList(p.children, inner),
    ]
      .filter(Boolean)
      .join("\n");
  };
  return props.map(item).join("\n");
}

// ---------- Markdown helpers ----------

/** `timeSince` → `time-since`, for heading ids. */
const kebab = (name: string) =>
  name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
const fence = (text: string) => `\`\`\`tsx\n${text}\n\`\`\``;
const code = (text: string) => (text.includes("`") ? `\`\`${text}\`\`` : `\`${text}\``);
/** Indents the following lines, so multi-line text stays inside its list item. */
const indent = (text: string, pad = "  ") => text.replace(/\n/g, `\n${pad}`);

/** Escapes characters MDX would read as JSX/expressions, outside of code. */
function escapeMdx(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```|`+[^`\n]*`+)/g)
    .map((chunk, i) => (i % 2 === 1 ? chunk : chunk.replace(/[{}<]/g, (c) => `\\${c}`)))
    .join("");
}
