export type TokenType =
  | "NUMBER"
  | "STRING"
  | "REF"
  | "NAME"
  | "COMMA"
  | "COLON"
  | "LPAREN"
  | "RPAREN"
  | "PLUS"
  | "MINUS"
  | "MUL"
  | "DIV"
  | "EQ"
  | "NE"
  | "GT"
  | "GE"
  | "LT"
  | "LE"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
}
