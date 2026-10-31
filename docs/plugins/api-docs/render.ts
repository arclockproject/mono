/**
 * Turns `Section`s into one MDX page. Exports are `##` headings and their
 * methods are `###` headings.
 *
 * Every section and method follows the same order: code, description, details
 * (params, props, …), examples, then methods.
 */
import type { Doc, Fn, Member, Prop, Section } from "./types";

const KIND_LABELS: Record<Section["kind"], string> = {
  function: "Function",
  component: "Component",
  namespace: "Object",
  object: "Object",
  class: "Class",
  instance: "Instance",
  variable: "Constant",
  type: "Type",
};

type Ids = Map<Section | Member, string>;

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
  const blocks = [
    `---\ntitle: ${JSON.stringify(page.title)}\n---`,
    `{/* Generated from ${page.sourceLabel} by plugins/api-docs. Edit the JSDoc there, not this file. */}`,
    importLine && fence(importLine),
    page.guideLink && `For examples and live demos, see the [${page.title} guide](${page.guideLink}).`,
    sections.length === 0 && "This module has no documented exports.",
    ...sections.flatMap((s) => renderSection(s, ids)),
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

function members(s: Section): Member[] {
  return s.kind === "namespace" || s.kind === "class" ? s.members : [];
}

function renderSection(s: Section, ids: Ids): string[] {
  const labels = [KIND_LABELS[s.kind]];
  if (s.isDefault) labels.push("default export");
  if (s.kind === "type" && s.internal) labels.push("not exported, used by the API above");
  if (s.kind === "instance") {
    const classSection = [...ids.keys()].find((k) => "kind" in k && k.name === s.className);
    labels[0] = `Instance of ${classSection ? `[\`${s.className}\`](#${ids.get(classSection)})` : code(s.className)}`;
  }
  return [
    `## ${s.kind === "function" ? `${s.name}()` : s.name} {#${ids.get(s)}}`,
    `_${labels.join(" · ")}_`,
    ...renderBody(s.doc, sectionCode(s), sectionDetails(s)),
    ...members(s).flatMap((m) => [`### ${m.owner}.${m.name}() {#${ids.get(m)}}`, ...renderFn(m.fn)]),
  ];
}

function sectionCode(s: Section): string | null {
  switch (s.kind) {
    case "function":
      return s.fn.signatures.join("\n");
    case "class":
      return s.header;
    case "variable":
      return s.signature;
    case "type":
      return s.code ?? s.header;
    default:
      return null;
  }
}

function sectionDetails(s: Section): string[] {
  switch (s.kind) {
    case "function":
      return fnDetails(s.fn);
    case "component":
      return [s.typeParams && `**Type parameters** ${code(s.typeParams)}`, renderProps("Props", s.props, s.inherits)].filter(
        Boolean,
      );
    case "object":
      return [renderProps("Properties", s.props, [])];
    case "class":
      return [
        ...(s.ctor
          ? [
              `**Constructor**\n\n${fence(s.ctor.signatures.join("\n"))}`,
              s.ctor.doc.description && escapeMdx(s.ctor.doc.description),
              s.ctor.params.length > 0 && renderList("Parameters", s.ctor.params),
            ]
          : []),
        s.props.length > 0 && renderProps("Properties", s.props, []),
      ].filter((b): b is string => !!b);
    case "type":
      return s.props.length > 0 ? [renderProps("Properties", s.props, [])] : [];
    default:
      return [];
  }
}

function renderFn(fn: Fn): string[] {
  return renderBody(fn.doc, fn.signatures.join("\n"), fnDetails(fn));
}

function fnDetails(fn: Fn): string[] {
  const blocks = fn.params.length > 0 ? [renderList("Parameters", fn.params)] : [];
  if (fn.doc.returns !== null || (fn.returnType && fn.returnType !== "void")) {
    const type = fn.returnType ? ` ${code(fn.returnType)}` : "";
    const desc = fn.doc.returns ? ` — ${indent(escapeMdx(fn.doc.returns))}` : "";
    blocks.push(`**Returns**${type}${desc}`);
  }
  return blocks;
}

/** Code, deprecation notice, description, details, examples and links, in that order. */
function renderBody(doc: Doc, codeBlock: string | null, details: string[]): string[] {
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

function renderProps(title: string, props: Prop[], inherits: string[]): string {
  const lines: string[] = [];
  if (props.length > 0) lines.push(propList(props, ""));
  if (inherits.length > 0) {
    lines.push(`${props.length > 0 ? "Also accepts" : "Accepts"} all props of ${inherits.map(code).join(" and ")}.`);
  }
  return `**${title}**\n\n${lines.length > 0 ? lines.join("\n\n") : "None."}`;
}

function renderList(title: string, props: Prop[]): string {
  return `**${title}**\n\n${propList(props, "")}`;
}

/** e.g. "- `speed?` (`number`, default `100`) — Milliseconds per character.", with nested fields indented. */
function propList(props: Prop[], pad: string): string {
  const inner = `${pad}  `;
  return props
    .map((p) => {
      const name = `${p.isStatic ? "static " : ""}${p.readonly ? "readonly " : ""}${p.name}${p.optional ? "?" : ""}`;
      const defaultValue = p.doc.defaultValue || p.defaultValue;
      const details = [p.type && code(p.type), defaultValue && `default ${code(defaultValue)}`].filter(Boolean);
      const lines = [
        `${pad}- ${code(name)}${details.length > 0 ? ` (${details.join(", ")})` : ""}` +
          `${p.doc.deprecated !== null ? " **Deprecated.**" : ""}` +
          `${p.doc.description ? ` — ${indent(escapeMdx(p.doc.description), inner)}` : ""}`,
        // Callback props can document their own `@param` and `@returns`.
        ...[...p.doc.params].map(([param, text]) => `${inner}- ${code(param)}${text ? ` — ${escapeMdx(text)}` : ""}`),
        p.doc.returns && `${inner}- Returns ${escapeMdx(p.doc.returns)}`,
        p.children.length > 0 && propList(p.children, inner),
      ];
      return lines.filter(Boolean).join("\n");
    })
    .join("\n");
}

// ---------- Markdown helpers ----------

function kebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function fence(text: string): string {
  return `\`\`\`tsx\n${text}\n\`\`\``;
}

function code(text: string): string {
  const ticks = text.includes("`") ? "``" : "`";
  return `${ticks}${text}${ticks}`;
}

/** Indents the following lines, so multi-line text stays inside its list item. */
function indent(text: string, pad = "  "): string {
  return text.replace(/\n/g, `\n${pad}`);
}

/** Escapes characters MDX would read as JSX/expressions, outside of code. */
function escapeMdx(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```|`+[^`\n]*`+)/g)
    .map((chunk, i) => (i % 2 === 1 ? chunk : chunk.replace(/[{}<]/g, (c) => `\\${c}`)))
    .join("");
}
