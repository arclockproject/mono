/** Parsed JSDoc of a single declaration. Text is markdown. */
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
  /** Set when the type is an inline object, so its fields can be listed too. */
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
export type Member = {
  name: string;
  /** The export it belongs to, e.g. `Time` for `Time.timeSince`. */
  owner: string;
  fn: Fn;
};

type Base = { name: string; isDefault: boolean; doc: Doc };

export type Section = Base &
  (
    | { kind: "function"; fn: Fn }
    | { kind: "component"; typeParams: string; props: Prop[]; inherits: string[] }
    | { kind: "namespace"; members: Member[] }
    | { kind: "object"; props: Prop[] }
    | { kind: "class"; header: string; ctor: Fn | null; props: Prop[]; members: Member[] }
    | { kind: "instance"; className: string }
    | { kind: "variable"; signature: string }
    | {
        kind: "type";
        header: string;
        /** The full type, for types that are not plain objects. */
        code: string | null;
        props: Prop[];
        /** Not exported, but used by the exported API. */
        internal: boolean;
      }
  );

export function emptyDoc(): Doc {
  return {
    description: "",
    params: new Map(),
    returns: null,
    examples: [],
    defaultValue: null,
    deprecated: null,
    see: [],
    hidden: false,
  };
}

export function prop(name: string, fields: Partial<Prop> = {}): Prop {
  return {
    name,
    type: null,
    optional: false,
    isStatic: false,
    readonly: false,
    defaultValue: null,
    doc: emptyDoc(),
    children: [],
    ...fields,
  };
}
