/**
 * Reads the exports of a package's entry files with the TypeScript compiler and
 * turns them into `Section`s for rendering.
 *
 * Types are shown as written in the source rather than computed by the type
 * checker. That keeps them readable, and lets the program skip loading
 * dependencies (`noResolve`), which keeps this fast enough for hot reload.
 *
 * Export kinds: `function X` / `const X = () =>` → function or component,
 * `const X = { a() {} }` → namespace, `const X = { a: 1 }` → object, `class` → class,
 * `const x = new X()` → instance, `type`/`interface` → type, any other `const` → variable.
 */
import path from "node:path";
import ts from "typescript";
import { type Doc, emptyDoc, type Fn, type Member, type Prop, prop, type Section } from "./types";

// ---------- Rules: change these if components are written in new ways ----------

/** A capitalised function with at most one parameter returning one of these is a component. */
const COMPONENT_RETURN_TYPE = /\b(JSX\.Element|ReactNode|ReactElement)\b/;
/** `const X: StyledComponent<Props> = …` is a component. Its first type argument holds the props. */
const COMPONENT_TYPE = /(^|\.)(StyledComponent|ComponentType|FC|FunctionComponent)$/;
/** `PropsWithChildren<P>` is read as `P` plus an optional `children`. */
const PROPS_WITH_CHILDREN = /(^|\.)PropsWithChildren$/;

type TagHandler = (doc: Doc, text: string, tag: ts.JSDocTag) => void;

/** What each JSDoc tag does to a `Doc`. Tags that are not listed are ignored. */
const TAGS = new Map<string, TagHandler>(Object.entries({
  param: (doc, text, tag) => doc.params.set((tag as ts.JSDocParameterTag).name.getText(), text),
  returns: (doc, text) => void (doc.returns = text),
  augments: (doc, text, tag) =>
    appendDescription(doc, `Extends \`${(tag as ts.JSDocAugmentsTag).class.getText()}\`.${text ? ` ${text}` : ""}`),
  deprecated: (doc, text) => void (doc.deprecated = text || "This is deprecated."),
  example: (doc, _, tag) => doc.examples.push(ts.getTextOfJSDocComment(tag.comment)?.replace(/^\n+|\s+$/g, "") ?? ""),
  default: (doc, text) => void (doc.defaultValue = text),
  defaultValue: (doc, text) => void (doc.defaultValue = text),
  remarks: (doc, text) => appendDescription(doc, text),
  internal: (doc) => void (doc.hidden = true),
  hidden: (doc) => void (doc.hidden = true),
  ignore: (doc) => void (doc.hidden = true),
  // `@see` is handled in `doc()`, since it needs to drop links back to the docs site.
} satisfies Record<string, TagHandler>));

/** The `TAGS` key of a tag. TS parses some tags into their own kinds and accepts aliases like `@return`. */
function tagName(tag: ts.JSDocTag): string {
  if (ts.isJSDocParameterTag(tag)) return "param";
  if (ts.isJSDocReturnTag(tag)) return "returns";
  if (ts.isJSDocAugmentsTag(tag)) return "augments";
  if (ts.isJSDocDeprecatedTag(tag)) return "deprecated";
  if (ts.isJSDocSeeTag(tag)) return "see";
  return tag.tagName.text;
}

// ---------- Analyzer ----------

export type Analyzer = { analyze(entry: string): Section[] };

type TypeDecl = ts.TypeAliasDeclaration | ts.InterfaceDeclaration;
type PropsResult = { props: Prop[]; inherits: string[] };
type Comment = string | ts.NodeArray<ts.JSDocComment> | undefined;

export function createAnalyzer(options: {
  tsconfig: string;
  /** Only types declared in here are documented as "internal" types. */
  srcDir: string;
  /** Links to this URL are dropped, since they point back at the docs site. */
  selfDocsUrl: string;
}): Analyzer {
  const config = ts.readConfigFile(options.tsconfig, ts.sys.readFile);
  if (config.error) throw new Error(`[api-docs] ${ts.flattenDiagnosticMessageText(config.error.messageText, "\n")}`);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(options.tsconfig));
  // Only the package's own files are loaded. Imports between them still resolve.
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noResolve: true, noLib: true, types: [], noEmit: true },
  });
  const checker = program.getTypeChecker();
  const printer = ts.createPrinter({ removeComments: true });
  const srcDir = path.resolve(options.srcDir) + path.sep;
  const isSelfLink = (url: string) => !!options.selfDocsUrl && url.startsWith(options.selfDocsUrl);

  const resolve = (symbol: ts.Symbol): ts.Symbol =>
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

  /** The type alias or interface in this package that a type name points to, if any. */
  const localTypeDecl = (name: ts.Node): TypeDecl | undefined => {
    const symbol = checker.getSymbolAtLocation(name);
    const decl = symbol && resolve(symbol).declarations?.[0];
    if (!decl || !path.resolve(decl.getSourceFile().fileName).startsWith(srcDir)) return undefined;
    return ts.isTypeAliasDeclaration(decl) || ts.isInterfaceDeclaration(decl) ? decl : undefined;
  };

  const checkerType = (node: ts.Node) =>
    checker.typeToString(checker.getTypeAtLocation(node), undefined, ts.TypeFormatFlags.NoTruncation);

  /** Reads one module. Remembers the local types its API uses, so they can be documented too. */
  class ModuleReader {
    /** Exported symbol → name it is documented under. */
    private exported = new Map<ts.Symbol, string>();
    /** Local types the API refers to but the module does not export. */
    private referenced: ts.Symbol[] = [];

    constructor(private sf: ts.SourceFile) {}

    read(): Section[] {
      const moduleSymbol = checker.getSymbolAtLocation(this.sf);
      if (!moduleSymbol) return [];

      // The same symbol can be exported twice, e.g. `export default Mmd` and `export { Mmd as MMD }`.
      const defaults = new Set<ts.Symbol>();
      for (const exp of checker.getExportsOfModule(moduleSymbol)) {
        const target = resolve(exp);
        if (exp.escapedName === "default") defaults.add(target);
        else if (!this.exported.has(target)) this.exported.set(target, exp.name);
      }
      for (const target of defaults) {
        const name = target.declarations?.[0] && ts.getNameOfDeclaration(target.declarations[0]);
        if (!this.exported.has(target)) this.exported.set(target, name && ts.isIdentifier(name) ? name.text : target.name);
      }

      const sections = [...this.exported]
        .map(([symbol, name]) => this.exportSection(symbol, name, defaults.has(symbol)))
        .filter((s): s is Section => !!s && !s.doc.hidden)
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

      // Reading a type can reference more types, so this list grows while looping.
      for (let i = 0; i < this.referenced.length; i++) {
        const symbol = this.referenced[i]!;
        const section = this.typeSection(symbol.name, symbol.declarations![0] as TypeDecl, false, true);
        if (!section.doc.hidden) sections.push(section);
      }
      return sections;
    }

    private exportSection(symbol: ts.Symbol, name: string, isDefault: boolean): Section | null {
      const decls = symbol.declarations ?? [];
      const decl = decls[0];
      if (!decl) return null;
      if (ts.isFunctionDeclaration(decl)) return this.functionSection(name, isDefault, decls.filter(ts.isFunctionDeclaration), decl);
      if (ts.isClassDeclaration(decl)) return this.classSection(name, isDefault, decl);
      if (ts.isTypeAliasDeclaration(decl) || ts.isInterfaceDeclaration(decl)) return this.typeSection(name, decl, isDefault, false);
      if (ts.isVariableDeclaration(decl)) return this.variableSection(name, isDefault, decl);
      return null;
    }

    // ---------- Sections ----------

    private functionSection(name: string, isDefault: boolean, decls: readonly ts.SignatureDeclaration[], docNode: ts.Node): Section {
      const main = decls[0]!;
      const returnsComponent = main.type
        ? COMPONENT_RETURN_TYPE.test(main.type.getText())
        : main.getSourceFile().fileName.endsWith(".tsx");
      if (!/^[A-Z]/.test(name) || main.parameters.length > 1 || !returnsComponent) {
        const fn = this.fn(name, decls, docNode);
        return { kind: "function", name, isDefault, doc: fn.doc, fn };
      }
      const propsType = main.parameters[0]?.type;
      return {
        kind: "component",
        name,
        isDefault,
        doc: this.doc(docNode),
        typeParams: this.typeParams(main),
        ...(propsType ? this.propsFromType(propsType) : { props: [], inherits: [] }),
      };
    }

    private variableSection(name: string, isDefault: boolean, decl: ts.VariableDeclaration): Section {
      const init = decl.initializer && unwrap(decl.initializer);
      if (init && isFunctionExpression(init)) return this.functionSection(name, isDefault, [init], decl);
      const base = { name, isDefault, doc: this.doc(decl) };

      if (init && ts.isObjectLiteralExpression(init)) {
        // An object of only functions, like `Time`, documents each function.
        const members = init.properties.map((p) => this.objectMember(name, p));
        if (members.length > 0 && members.every((m) => m !== null)) return { ...base, kind: "namespace", members: members as Member[] };
        return { ...base, kind: "object", props: this.propsFromObject(init) };
      }
      if (init && ts.isNewExpression(init)) {
        const classSymbol = checker.getSymbolAtLocation(init.expression);
        const target = classSymbol && resolve(classSymbol);
        if (target?.declarations?.some(ts.isClassDeclaration)) {
          return { ...base, kind: "instance", className: this.exported.get(target) ?? target.name };
        }
      }
      const typeRef = decl.type && ts.isTypeReferenceNode(decl.type) ? decl.type : undefined;
      const propsArg = typeRef?.typeArguments?.[0];
      if (propsArg && COMPONENT_TYPE.test(typeRef!.typeName.getText())) {
        return { ...base, kind: "component", typeParams: "", ...this.propsFromType(propsArg) };
      }
      const type = decl.type ? this.typeText(decl.type) : checkerType(decl);
      return { ...base, kind: "variable", signature: `const ${name}: ${type}` };
    }

    private classSection(name: string, isDefault: boolean, decl: ts.ClassDeclaration): Section {
      const ctors = decl.members.filter(ts.isConstructorDeclaration);
      const props: Prop[] = [];
      const methods = new Map<string, { decls: ts.SignatureDeclaration[]; docNode: ts.Node; isStatic: boolean }>();

      // `constructor(public x: number)` also declares a property, described by the constructor's `@param`.
      for (const param of ctors.flatMap((c) => c.parameters)) {
        if (!ts.isParameterPropertyDeclaration(param, param.parent) || !isPublic(param)) continue;
        const readonly = hasModifier(param, ts.SyntaxKind.ReadonlyKeyword);
        props.push(this.param(param, this.doc(param.parent), { readonly, optional: false, defaultValue: null }));
      }

      for (const member of decl.members) {
        if (!member.name || ts.isPrivateIdentifier(member.name) || !isPublic(member)) continue;
        const memberName = member.name.getText();
        const isStatic = hasModifier(member, ts.SyntaxKind.StaticKeyword);
        const signature = methodSignature(member);
        if (signature) {
          // Overloads share a name, so they are collected first.
          const method = methods.get(memberName) ?? { decls: [], docNode: member, isStatic };
          method.decls.push(signature);
          methods.set(memberName, method);
        } else if (ts.isPropertyDeclaration(member)) {
          const { type, initializer: init } = member;
          props.push(
            prop(memberName, {
              type: type ? this.typeText(type) : init ? this.valueType(init) : null,
              optional: !!member.questionToken,
              isStatic,
              readonly: hasModifier(member, ts.SyntaxKind.ReadonlyKeyword),
              defaultValue: init ? literalText(init) : null,
              doc: this.doc(member),
            }),
          );
        } else if (ts.isGetAccessorDeclaration(member)) {
          const hasSetter = decl.members.some((m) => ts.isSetAccessorDeclaration(m) && m.name.getText() === memberName);
          const type = member.type ? this.typeText(member.type) : null;
          props.push(prop(memberName, { type, isStatic, readonly: !hasSetter, doc: this.doc(member) }));
        }
      }

      const members = [...methods].map(([memberName, m]): Member => ({
        name: memberName,
        owner: name,
        fn: this.fn(`${name}.${memberName}`, m.decls, m.docNode, m.isStatic ? "static " : ""),
      }));
      const heritage = this.heritage(decl);
      return {
        kind: "class",
        name,
        isDefault,
        doc: this.doc(decl),
        header: `class ${name}${this.typeParams(decl)}${heritage}`,
        ctor: ctors.length > 0 ? this.fn(`new ${name}`, ctors, ctors[0]!) : null,
        props: props.filter((p) => !p.doc.hidden),
        members: members.filter((m) => !m.fn.doc.hidden),
      };
    }

    private typeSection(name: string, decl: TypeDecl, isDefault: boolean, internal: boolean): Section {
      const typeParams = this.typeParams(decl);
      const base = { kind: "type" as const, name, isDefault, internal, doc: this.doc(decl), code: null };
      if (ts.isInterfaceDeclaration(decl)) {
        const header = `interface ${name}${typeParams}${this.heritage(decl)}`;
        return { ...base, header, props: this.propsFromMembers(decl.members) };
      }
      const header = `type ${name}${typeParams}`;
      if (ts.isTypeLiteralNode(decl.type)) return { ...base, header, props: this.propsFromMembers(decl.type.members) };
      this.noteTypes(decl.type);
      return { ...base, header, code: `${header} = ${this.print(decl.type)}`, props: [] };
    }

    // ---------- Functions ----------

    /** A function of an object namespace like `Time`, or `null` if the value is not a function. */
    private objectMember(owner: string, p: ts.ObjectLiteralElementLike): Member | null {
      if (!p.name || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) return null;
      const init = ts.isPropertyAssignment(p) ? unwrap(p.initializer) : undefined;
      const fn = ts.isMethodDeclaration(p) ? p : init && isFunctionExpression(init) ? init : undefined;
      return fn ? { name: p.name.text, owner, fn: this.fn(`${owner}.${p.name.text}`, [fn], p) } : null;
    }

    /** `decls` holds every overload. Only the overloads are shown, not the implementation. */
    private fn(display: string, decls: readonly ts.SignatureDeclaration[], docNode: ts.Node, prefix = ""): Fn {
      const overloads = decls.filter((d) => !("body" in d) || !d.body);
      const shown = decls.length > 1 && overloads.length > 0 ? overloads : decls;
      const doc = this.doc([docNode, ...decls].find((n) => getJsDoc(n)) ?? docNode);
      const main = shown[0]!;
      return {
        signatures: shown.map((s) => `${prefix}${display}${this.signature(s)}`),
        params: main.parameters.map((p) => this.param(p, doc)),
        returnType: this.returnType(main),
        doc,
      };
    }

    /** `<T>(a: string): R`, or `<T>(a: string) => R` with `arrow`. */
    private signature(s: ts.SignatureDeclaration, arrow = false): string {
      const params = s.parameters.map((p) => {
        if (p.type) this.noteTypes(p.type);
        // Drop `public`/`readonly` from constructor parameter properties.
        const { dotDotDotToken, name, questionToken, type, initializer } = p;
        return this.print(p.modifiers ? ts.factory.updateParameterDeclaration(p, undefined, dotDotDotToken, name, questionToken, type, initializer) : p);
      });
      const returnType = this.returnType(s);
      const returns = arrow ? ` => ${returnType ?? "unknown"}` : returnType ? `: ${returnType}` : "";
      return oneLine(`${this.typeParams(s)}(${params.join(", ")})${returns}`);
    }

    /** The written return type, else the inferred one. `null` for constructors and `any`. */
    private returnType(s: ts.SignatureDeclaration): string | null {
      if (ts.isConstructorDeclaration(s)) return null;
      if (s.type) return this.typeText(s.type);
      const signature = checker.getSignatureFromDeclaration(s);
      const text = signature && checker.typeToString(checker.getReturnTypeOfSignature(signature));
      return text && text !== "any" ? text : null;
    }

    private param(p: ts.ParameterDeclaration, fnDoc: Doc, fields: Partial<Prop> = {}): Prop {
      const name = p.name.getText();
      const doc = emptyDoc();
      doc.description = fnDoc.params.get(name) || this.commentText(getOwnJsDoc(p)?.comment);
      return this.typedProp(`${p.dotDotDotToken ? "..." : ""}${name}`, p.type, {
        optional: !!p.questionToken || !!p.initializer,
        defaultValue: p.initializer ? oneLine(this.print(p.initializer)) : null,
        doc,
        ...fields,
      });
    }

    // ---------- Props ----------

    /** A prop with a written type. Inline object types, like `options?: { loop?: boolean }`, list their fields. */
    private typedProp(name: string, type: ts.TypeNode | undefined, fields: Partial<Prop>): Prop {
      const nested = type && ts.isTypeLiteralNode(type) ? type : undefined;
      return prop(name, {
        type: nested ? "object" : type ? this.typeText(type) : null,
        children: nested ? this.propsFromMembers(nested.members) : [],
        ...fields,
      });
    }

    /**
     * Lists the props of a component's props type. Props declared in this package
     * are listed. Types from elsewhere, like MUI's `TypographyProps`, are only
     * named, since they can have hundreds of props.
     */
    private propsFromType(node: ts.TypeNode, seen = new Set<ts.Node>()): PropsResult {
      const merge = (parts: PropsResult[]) => ({ props: parts.flatMap((p) => p.props), inherits: parts.flatMap((p) => p.inherits) });
      if (ts.isParenthesizedTypeNode(node)) return this.propsFromType(node.type, seen);
      if (ts.isTypeLiteralNode(node)) return { props: this.propsFromMembers(node.members), inherits: [] };
      if (ts.isIntersectionTypeNode(node)) return merge(node.types.map((t) => this.propsFromType(t, seen)));
      if (ts.isTypeReferenceNode(node)) {
        if (PROPS_WITH_CHILDREN.test(node.typeName.getText())) {
          const inner = node.typeArguments?.[0];
          const children = { props: [prop("children", { type: "ReactNode", optional: true })], inherits: [] };
          return merge([inner ? this.propsFromType(inner, seen) : { props: [], inherits: [] }, children]);
        }
        const decl = localTypeDecl(node.typeName);
        if (decl && !seen.has(decl)) {
          seen.add(decl); // Each type is followed once, so recursive types don't loop.
          if (ts.isTypeAliasDeclaration(decl)) return this.propsFromType(decl.type, seen);
          const inherits = decl.heritageClauses?.flatMap((h) => h.types.map((t) => this.typeText(t))) ?? [];
          return { props: this.propsFromMembers(decl.members), inherits };
        }
      }
      return { props: [], inherits: [this.typeText(node)] };
    }

    /** The members of an interface or object type. */
    private propsFromMembers(members: ts.NodeArray<ts.TypeElement>): Prop[] {
      return members.flatMap((m): Prop[] => {
        const doc = this.doc(m);
        if (doc.hidden) return [];
        const readonly = hasModifier(m, ts.SyntaxKind.ReadonlyKeyword);
        const optional = !!m.questionToken;
        if (ts.isPropertySignature(m)) return [this.typedProp(m.name.getText(), m.type, { optional, readonly, doc })];
        if (ts.isMethodSignature(m)) return [prop(m.name.getText(), { type: this.signature(m, true), optional, doc })];
        if (ts.isIndexSignatureDeclaration(m)) {
          const key = oneLine(m.parameters.map((p) => this.print(p)).join(", "));
          return [prop(`[${key}]`, { type: this.typeText(m.type), readonly, doc })];
        }
        return [];
      });
    }

    /** The properties of an object literal, like a settings object. */
    private propsFromObject(obj: ts.ObjectLiteralExpression): Prop[] {
      return obj.properties.flatMap((p): Prop[] => {
        if (!p.name || ts.isComputedPropertyName(p.name)) return [];
        const doc = this.doc(p);
        if (doc.hidden) return [];
        const name = p.name.getText();
        if (ts.isPropertyAssignment(p)) {
          const nested = ts.isObjectLiteralExpression(p.initializer) ? p.initializer : undefined;
          const type = nested ? "object" : this.valueType(p.initializer);
          const children = nested ? this.propsFromObject(nested) : [];
          return [prop(name, { type, defaultValue: literalText(p.initializer), doc, children })];
        }
        if (ts.isMethodDeclaration(p)) return [prop(name, { type: this.signature(p, true), doc })];
        if (ts.isShorthandPropertyAssignment(p)) return [prop(name, { type: checkerType(p), doc })];
        return [];
      });
    }

    /** The type of a value, read from how it is written where possible. */
    private valueType(init: ts.Expression): string {
      if (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) return this.typeText(init.type);
      if (ts.isParenthesizedExpression(init)) return this.valueType(init.expression);
      if (isFunctionExpression(init)) return this.signature(init, true);
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init) || ts.isTemplateExpression(init)) return "string";
      if (ts.isNumericLiteral(init)) return "number";
      if (init.kind === ts.SyntaxKind.TrueKeyword || init.kind === ts.SyntaxKind.FalseKeyword) return "boolean";
      if (ts.isObjectLiteralExpression(init)) return "object";
      return checkerType(init);
    }

    // ---------- Types ----------

    /** A type on one line. Also remembers the local types in it. */
    private typeText(node: ts.Node): string {
      this.noteTypes(node);
      return oneLine(this.print(node));
    }

    private typeParams(node: { typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration> }): string {
      return node.typeParameters?.length ? `<${node.typeParameters.map((t) => this.typeText(t)).join(", ")}>` : "";
    }

    /** ` extends A implements B`, or `""`. */
    private heritage(decl: ts.ClassDeclaration | ts.InterfaceDeclaration): string {
      return decl.heritageClauses?.map((h) => ` ${this.typeText(h)}`).join("") ?? "";
    }

    /** Remembers local types used by the API, so they can be documented too. */
    private noteTypes(node: ts.Node): void {
      const name = ts.isTypeReferenceNode(node) ? node.typeName : ts.isExpressionWithTypeArguments(node) ? node.expression : undefined;
      if (name && localTypeDecl(name)) {
        const symbol = resolve(checker.getSymbolAtLocation(name)!);
        if (!this.exported.has(symbol) && !this.referenced.includes(symbol)) this.referenced.push(symbol);
      }
      ts.forEachChild(node, (child) => this.noteTypes(child));
    }

    private print(node: ts.Node): string {
      // Nodes can come from other files in the package, and edited copies have no parent.
      return printer.printNode(ts.EmitHint.Unspecified, node, ts.getOriginalNode(node).getSourceFile() ?? this.sf);
    }

    // ---------- JSDoc ----------

    private doc(node: ts.Node): Doc {
      const jsDoc = getJsDoc(node);
      const doc = emptyDoc();
      doc.description = this.commentText(jsDoc?.comment);
      for (const tag of jsDoc?.tags ?? []) {
        const text = this.commentText(tag.comment);
        if (!ts.isJSDocSeeTag(tag)) {
          TAGS.get(tagName(tag))?.(doc, text, tag);
          continue;
        }
        // `@see https://x` parses as the name `https` followed by the comment `://x`.
        // Self links are already dropped, so trim separators left behind, e.g. the `|` in `Guide | API`.
        const raw = `${tag.name ? tag.name.getText() : ""}${text}`.replace(/^[\s|,;·—-]+|[\s|,;·—-]+$/g, "");
        if (raw && !isSelfLink(raw)) doc.see.push(/^https?:\/\/\S+$/.test(raw) ? `[${raw}](${raw})` : raw);
      }
      return doc;
    }

    /** Flattens a JSDoc comment to markdown, turning `{@link}` into links or inline code. */
    private commentText(comment: Comment): string {
      if (!comment) return "";
      const parts = typeof comment === "string" ? [comment] : comment.map((part) => {
        if (part.kind === ts.SyntaxKind.JSDocText) return part.text;
        // TS splits URLs oddly: `https://x Label` parses as name "https", text "://x Label".
        const [target = "", ...words] = `${part.name ? part.name.getText() : ""}${part.text}`.trim().split(/\s+/);
        const label = words.join(" ") || target;
        if (!/^https?:\/\//.test(target)) return `\`${label}\``;
        return isSelfLink(target) ? "" : `[${label}](${target})`;
      });
      return parts.join("").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
    }
  }

  return {
    analyze(entry) {
      const sf = program.getSourceFile(path.resolve(entry));
      if (!sf) throw new Error(`[api-docs] ${entry} is not part of ${options.tsconfig}.`);
      return new ModuleReader(sf).read();
    },
  };
}

// ---------- Helpers ----------

function appendDescription(doc: Doc, text: string): void {
  doc.description = [doc.description, text].filter(Boolean).join("\n\n");
}

const getOwnJsDoc = (node: ts.Node) => (node as { jsDoc?: ts.JSDoc[] }).jsDoc?.at(-1);
const getJsDoc = (node: ts.Node) => getOwnJsDoc(node) ?? ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc).at(-1);
const isFunctionExpression = (node: ts.Node): node is ts.ArrowFunction | ts.FunctionExpression =>
  ts.isArrowFunction(node) || ts.isFunctionExpression(node);
const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === kind);
const isPublic = (node: ts.Node) =>
  !hasModifier(node, ts.SyntaxKind.PrivateKeyword) && !hasModifier(node, ts.SyntaxKind.ProtectedKeyword);

/** A class member that reads as a method: a method, or a property holding a function, like `random = Math.random`. */
function methodSignature(member: ts.ClassElement): ts.SignatureDeclaration | undefined {
  if (ts.isMethodDeclaration(member)) return member;
  if (!ts.isPropertyDeclaration(member)) return undefined;
  if (member.type) return ts.isFunctionTypeNode(member.type) ? member.type : undefined;
  const init = member.initializer && unwrap(member.initializer);
  return init && isFunctionExpression(init) ? init : undefined;
}

/** Removes `as`, `satisfies` and parentheses around an expression. */
function unwrap(expr: ts.Expression): ts.Expression {
  while (ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isParenthesizedExpression(expr)) expr = expr.expression;
  return expr;
}

/** The source text of a simple literal, used as a default value. */
function literalText(init: ts.Expression): string | null {
  const v = unwrap(init);
  const simple =
    ts.isStringLiteral(v) ||
    ts.isNumericLiteral(v) ||
    ts.isNoSubstitutionTemplateLiteral(v) ||
    [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].some((k) => k === v.kind) ||
    (ts.isPrefixUnaryExpression(v) && ts.isNumericLiteral(v.operand)) ||
    (ts.isIdentifier(v) && (v.text === "undefined" || v.text === "Infinity"));
  return simple ? v.getText() : null;
}

/** Collapses printed code to one line, e.g. `{ x: number; }` to `{ x: number }`. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").replace(/([([]) /g, "$1").replace(/ ([)\]])/g, "$1").replace(/; }/g, " }").trim();
}
