export type TokenType =
  | "NUMBER"
  | "STRING"
  | "REF"
  | "SHEET"
  | "BANG"
  | "NAME"
  | "COMMA"
  | "COLON"
  | "LPAREN"
  | "RPAREN"
  | "PLUS"
  | "MINUS"
  | "MUL"
  | "DIV"
  | "AMP"
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
