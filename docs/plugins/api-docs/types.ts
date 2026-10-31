/** The data passed from `extract.ts` (reads TypeScript) to `render.ts` (writes MDX). Text is markdown. */

/** Parsed JSDoc of a single declaration. */
export type Doc = {
  description: string;
  params: Map<string, string>;
  returns: string | null;
  examples: string[];
  defaultValue: string | null;
  deprecated: string | null;
  see: string[];
  /** `@internal`, `@hidden` or `@ignore`: leave it out of the docs. */
  hidden: boolean;
};

/** A named value with a type: a parameter, prop, property or field. */
export type Prop = {
  name: string;
  type: string | null;
  optional: boolean;
  isStatic: boolean;
  readonly: boolean;
  defaultValue: string | null;
  doc: Doc;
  /** Fields of an inline object type, e.g. `options?: { loop?: boolean }`. */
  children: Prop[];
};

export type Fn = {
  /** One per overload, e.g. `Time.timeSince(date: number | string): string`. */
  signatures: string[];
  params: Prop[];
  returnType: string | null;
  doc: Doc;
};

/** A method of a class or a function of an object namespace like `Time`. */
export type Member = { name: string; owner: string; fn: Fn };

/** One `##` section of a page. To add a kind, add it here, in `extract.ts` and in `KINDS` in `render.ts`. */
export type Section = { name: string; isDefault: boolean; doc: Doc } & (
  | { kind: "function"; fn: Fn }
  | { kind: "component"; typeParams: string; props: Prop[]; inherits: string[] }
  | { kind: "namespace"; members: Member[] } // An object of functions, like `Time`.
  | { kind: "object"; props: Prop[] }
  | { kind: "class"; header: string; ctor: Fn | null; props: Prop[]; members: Member[] }
  | { kind: "instance"; className: string } // `const x = new SomeClass()`.
  | { kind: "variable"; signature: string }
  /** `code` is the full type for non-object types. `internal`: not exported, but used by the API. */
  | { kind: "type"; header: string; code: string | null; props: Prop[]; internal: boolean }
);

export const emptyDoc = (): Doc => ({
  description: "",
  params: new Map(),
  returns: null,
  examples: [],
  defaultValue: null,
  deprecated: null,
  see: [],
  hidden: false,
});

export const prop = (name: string, fields: Partial<Prop> = {}): Prop => ({
  name,
  type: null,
  optional: false,
  isStatic: false,
  readonly: false,
  defaultValue: null,
  doc: emptyDoc(),
  children: [],
  ...fields,
});
