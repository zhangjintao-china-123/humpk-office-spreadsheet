export type Ast =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "ref"; value: string; sheet?: string }
  | { kind: "range"; start: string; end: string; sheet?: string }
  | { kind: "unary"; op: "-"; expr: Ast }
  | { kind: "binary"; op: "+" | "-" | "*" | "/" | "&" | "=" | "<>" | ">" | ">=" | "<" | "<="; left: Ast; right: Ast }
  | { kind: "call"; name: string; args: Ast[] };
