const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function stringAt(index: number): string {
  let n = index + 1;
  let text = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    text = LETTERS[rem] + text;
    n = Math.floor((n - 1) / 26);
  }
  return text;
}

export function indexAt(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    if (ch < "A" || ch > "Z") {
      break;
    }
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

export function expr2xy(ref: string): [number, number] {
  let letters = "";
  let digits = "";
  for (const ch of ref.toUpperCase()) {
    if (ch >= "0" && ch <= "9") {
      digits += ch;
    } else if (ch >= "A" && ch <= "Z") {
      letters += ch;
    }
  }
  return [indexAt(letters), Math.max(0, Number.parseInt(digits, 10) - 1)];
}

export function xy2expr(ci: number, ri: number): string {
  return `${stringAt(ci)}${ri + 1}`;
}

export function expr2expr(ref: string, dci: number, dri: number): string {
  const [ci, ri] = expr2xy(ref);
  return xy2expr(ci + dci, ri + dri);
}
