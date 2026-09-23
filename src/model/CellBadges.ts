import { expr2xy } from "../shared/alphabet";

export type ReconcileBadge = {
  sheetName: string
  ref: string
}

export class CellBadges {
  private readonly bySheet = new Map<string, Set<string>>()

  setChecks(items: ReconcileBadge[]): void {
    this.clearAll()
    for (const item of items) {
      const sheetName = item.sheetName.trim()
      const ref = item.ref.trim().toUpperCase()
      if (!sheetName || !ref) continue
      const [ci, ri] = expr2xy(ref)
      if (ci < 0 || ri < 0 || !Number.isFinite(ci) || !Number.isFinite(ri)) continue
      const set = this.bySheet.get(sheetName) ?? new Set<string>()
      set.add(`${ri},${ci}`)
      this.bySheet.set(sheetName, set)
    }
  }

  onSheet(sheetName: string): Array<{ ri: number; ci: number }> {
    const set = this.bySheet.get(sheetName.trim())
    if (!set) return []
    return [...set].map((key) => {
      const [ri, ci] = key.split(",").map(Number)
      return { ri, ci }
    })
  }

  clearAll(): void {
    this.bySheet.clear()
  }

  renameSheet(from: string, to: string): void {
    const prev = from.trim()
    const next = to.trim()
    if (!prev || !next || prev === next) return
    const cells = this.bySheet.get(prev)
    if (!cells) return
    this.bySheet.delete(prev)
    const merged = this.bySheet.get(next) ?? new Set<string>()
    for (const key of cells) merged.add(key)
    this.bySheet.set(next, merged)
  }
}
