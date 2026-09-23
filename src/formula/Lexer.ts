import type { Token, TokenType } from "./Token";

const SINGLE: Record<string, TokenType> = {
  ",": "COMMA",
  ":": "COLON",
  "(": "LPAREN",
  ")": "RPAREN",
  "+": "PLUS",
  "-": "MINUS",
  "*": "MUL",
  "/": "DIV",
  "&": "AMP",
};

export class Lexer {
  private i = 0;

  constructor(private readonly src: string) {}

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (ch === " " || ch === "\t" || ch === "\n") {
        this.i += 1;
        continue;
      }
      if (ch === '"') {
        tokens.push(this.readString());
        continue;
      }
      if (ch === "'") {
        tokens.push(this.readQuotedSheet());
        continue;
      }
      if (ch === "!") {
        tokens.push({ type: "BANG", value: "!" });
        this.i += 1;
        continue;
      }
      if (isDigit(ch) || (ch === "." && isDigit(this.src[this.i + 1] ?? ""))) {
        tokens.push(this.readNumber());
        continue;
      }
      if (isLetter(ch) || ch === "$") {
        tokens.push(this.readNameOrRef());
        continue;
      }
      if (ch === ">" || ch === "<" || ch === "=") {
        tokens.push(this.readCompare());
        continue;
      }
      const type = SINGLE[ch];
      if (type) {
        tokens.push({ type, value: ch });
        this.i += 1;
        continue;
      }
      throw new Error(`unexpected '${ch}'`);
    }
    tokens.push({ type: "EOF", value: "" });
    return tokens;
  }

  private readQuotedSheet(): Token {
    this.i += 1;
    let value = "";
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (ch === "'") {
        if (this.src[this.i + 1] === "'") {
          value += "'";
          this.i += 2;
          continue;
        }
        this.i += 1;
        return { type: "SHEET", value };
      }
      value += ch;
      this.i += 1;
    }
    throw new Error("unterminated sheet name");
  }

  private readString(): Token {
    this.i += 1;
    let value = "";
    while (this.i < this.src.length && this.src[this.i] !== '"') {
      value += this.src[this.i];
      this.i += 1;
    }
    if (this.src[this.i] !== '"') {
      throw new Error("unterminated string");
    }
    this.i += 1;
    return { type: "STRING", value };
  }

  private readNumber(): Token {
    let value = "";
    while (isDigit(this.src[this.i] ?? "") || this.src[this.i] === ".") {
      value += this.src[this.i];
      this.i += 1;
    }
    let j = this.i;
    while (this.src[j] === " " || this.src[j] === "\t") {
      j += 1;
    }
    if (this.src[j] === "%" || this.src[j] === "％") {
      this.i = j + 1;
      return { type: "NUMBER", value: String(Number(value) / 100) };
    }
    return { type: "NUMBER", value };
  }

  private readNameOrRef(): Token {
    let value = "";
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      if (isLetter(ch) || isDigit(ch) || ch === "$" || ch === "_") {
        value += ch;
        this.i += 1;
      } else {
        break;
      }
    }
    const clean = value.replaceAll("$", "");
    if (/^[A-Z]+[0-9]+$/i.test(clean)) {
      return { type: "REF", value: clean.toUpperCase() };
    }
    return { type: "NAME", value: clean.toUpperCase() };
  }

  private readCompare(): Token {
    const ch = this.src[this.i];
    const next = this.src[this.i + 1] ?? "";
    if (ch === ">" && next === "=") {
      this.i += 2;
      return { type: "GE", value: ">=" };
    }
    if (ch === "<" && next === "=") {
      this.i += 2;
      return { type: "LE", value: "<=" };
    }
    if (ch === "<" && next === ">") {
      this.i += 2;
      return { type: "NE", value: "<>" };
    }
    this.i += 1;
    if (ch === ">") {
      return { type: "GT", value: ">" };
    }
    if (ch === "<") {
      return { type: "LT", value: "<" };
    }
    return { type: "EQ", value: "=" };
  }
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isLetter(ch: string): boolean {
  return /\p{L}/u.test(ch);
}
