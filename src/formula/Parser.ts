import type { Ast } from "./Ast";
import type { Token } from "./Token";

export class Parser {
  private i = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): Ast {
    const ast = this.compare();
    this.expect("EOF");
    return ast;
  }

  private compare(): Ast {
    let left = this.concat();
    const token = this.peek();
    const op = compareOp(token.type);
    if (!op) {
      return left;
    }
    this.next();
    return { kind: "binary", op, left, right: this.concat() };
  }

  private concat(): Ast {
    let left = this.expr();
    while (this.peek().type === "AMP") {
      this.next();
      left = { kind: "binary", op: "&", left, right: this.expr() };
    }
    return left;
  }

  private expr(): Ast {
    let left = this.term();
    while (this.peek().type === "PLUS" || this.peek().type === "MINUS") {
      const op = this.next().type === "PLUS" ? "+" : "-";
      left = { kind: "binary", op, left, right: this.term() };
    }
    return left;
  }

  private term(): Ast {
    let left = this.unary();
    while (this.peek().type === "MUL" || this.peek().type === "DIV") {
      const op = this.next().type === "MUL" ? "*" : "/";
      left = { kind: "binary", op, left, right: this.unary() };
    }
    return left;
  }

  private unary(): Ast {
    if (this.peek().type === "MINUS") {
      this.next();
      return { kind: "unary", op: "-", expr: this.unary() };
    }
    return this.primary();
  }

  private primary(): Ast {
    const token = this.peek();
    if (token.type === "NUMBER" && this.peekAt(1).type !== "BANG") {
      this.next();
      return { kind: "number", value: Number(token.value) };
    }
    if (token.type === "STRING") {
      this.next();
      return { kind: "string", value: token.value };
    }
    const sheet = this.trySheetPrefix();
    const location = this.tryRefOrColumnRange(sheet);
    if (location) {
      return location;
    }
    if (sheet) {
      throw new Error("expected REF after sheet name");
    }
    if (token.type === "NAME") {
      this.next();
      if (this.peek().type !== "LPAREN" && (token.value === "TRUE" || token.value === "FALSE")) {
        return { kind: "call", name: token.value, args: [] };
      }
      this.expect("LPAREN");
      const args: Ast[] = [];
      if (this.peek().type !== "RPAREN") {
        args.push(this.compare());
        while (this.peek().type === "COMMA") {
          this.next();
          args.push(this.compare());
        }
      }
      this.expect("RPAREN");
      return { kind: "call", name: token.value, args };
    }
    if (token.type === "LPAREN") {
      this.next();
      const inner = this.compare();
      this.expect("RPAREN");
      return inner;
    }
    throw new Error(`unexpected token ${token.type}`);
  }

  private tryRefOrColumnRange(sheet?: string): Ast | undefined {
    if (this.peek().type === "REF") {
      const ref = this.next();
      if (this.peek().type === "COLON") {
        this.next();
        const end = this.expect("REF");
        return { kind: "range", start: ref.value, end: end.value, ...(sheet ? { sheet } : {}) };
      }
      return { kind: "ref", value: ref.value, ...(sheet ? { sheet } : {}) };
    }
    if (this.peek().type === "NAME" && isColumnName(this.peek().value) && this.peekAt(1).type === "COLON") {
      const start = this.next();
      this.next();
      if (this.peek().type !== "NAME" || !isColumnName(this.peek().value)) {
        throw new Error("expected column range end");
      }
      const end = this.next();
      return { kind: "range", start: start.value, end: end.value, ...(sheet ? { sheet } : {}) };
    }
    return undefined;
  }

  private trySheetPrefix(): string | undefined {
    const token = this.peek();
    if (token.type === "SHEET") {
      this.next();
      this.expect("BANG");
      return token.value;
    }
    if ((token.type === "NAME" || token.type === "REF" || token.type === "NUMBER") && this.peekAt(1).type === "BANG") {
      this.next();
      this.next();
      return token.value;
    }
    return undefined;
  }

  private peek(): Token {
    return this.tokens[this.i];
  }

  private peekAt(offset: number): Token {
    return this.tokens[this.i + offset] ?? { type: "EOF", value: "" };
  }

  private next(): Token {
    const token = this.tokens[this.i];
    this.i += 1;
    return token;
  }

  private expect(type: Token["type"]): Token {
    const token = this.next();
    if (token.type !== type) {
      throw new Error(`expected ${type}, got ${token.type}`);
    }
    return token;
  }
}

function isColumnName(value: string): boolean {
  return /^[A-Z]+$/i.test(value);
}

function compareOp(type: Token["type"]): "=" | "<>" | ">" | ">=" | "<" | "<=" | undefined {
  if (type === "EQ") {
    return "=";
  }
  if (type === "NE") {
    return "<>";
  }
  if (type === "GT") {
    return ">";
  }
  if (type === "GE") {
    return ">=";
  }
  if (type === "LT") {
    return "<";
  }
  if (type === "LE") {
    return "<=";
  }
  return undefined;
}
