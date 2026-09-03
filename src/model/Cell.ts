export interface Cell {
  text?: string;
  value?: string | number;
  style?: number;
  merge?: [number, number];
}

export function cloneCell(cell: Cell | undefined): Cell | undefined {
  if (!cell) {
    return undefined;
  }
  return {
    ...cell,
    merge: cell.merge ? [cell.merge[0], cell.merge[1]] : undefined,
  };
}

export function isFormula(text: string | undefined): boolean {
  return !!text && text.startsWith("=");
}

export function cellDisplay(cell: Cell | undefined): string {
  if (!cell) {
    return "";
  }
  if (cell.value !== undefined && cell.value !== "") {
    return String(cell.value);
  }
  return cell.text ?? "";
}
