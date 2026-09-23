export interface FormulaErrorValue {
  readonly error: string
}

export type FormulaValue = string | number | boolean | null | FormulaErrorValue

export type FormulaFn = (args: FormulaValue[][]) => FormulaValue

export function isErrorValue(value: FormulaValue): value is FormulaErrorValue {
  return typeof value === "object" && value !== null && "error" in value
}

export function errorValue(code: string): FormulaErrorValue {
  return { error: code }
}

export function firstError(values: FormulaValue[]): FormulaErrorValue | undefined {
  return values.find(isErrorValue)
}

export function flatten(groups: FormulaValue[][]): FormulaValue[] {
  return groups.flat()
}

export function toNumber(value: FormulaValue): number | null {
  if (isErrorValue(value) || value === null || value === "") {
    return null
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function excelLogical(value: FormulaValue): boolean | FormulaErrorValue {
  if (isErrorValue(value)) return value
  if (value === null || value === "" || value === 0 || value === false) return false
  if (value === true) return true
  if (typeof value === "number") return value !== 0
  const text = String(value).trim().toUpperCase()
  if (text === "TRUE") return true
  if (text === "FALSE") return false
  return errorValue("#VALUE!")
}

function numbers(groups: FormulaValue[][]): number[] | FormulaErrorValue {
  const list = flatten(groups)
  const err = firstError(list)
  if (err) return err
  return list.map(toNumber).filter((value): value is number => value !== null)
}

function requireNumbers(groups: FormulaValue[][]): number[] | FormulaErrorValue {
  const result = numbers(groups)
  if (!Array.isArray(result)) return result
  return result
}

export function matchCriteria(value: FormulaValue, criteria: FormulaValue): boolean {
  if (isErrorValue(value) || isErrorValue(criteria)) return false
  if (typeof criteria === "number" || typeof criteria === "boolean") {
    const n = toNumber(value)
    return n !== null && n === Number(criteria)
  }
  const raw = String(criteria)
  const matched = raw.match(/^(<=|>=|<>|<|>|=)(.*)$/)
  const op = matched?.[1] ?? "="
  const rest = matched?.[2] ?? raw
  const restNum = rest.trim() === "" ? NaN : Number(rest)
  const valueNum = toNumber(value)
  if (rest !== "" && Number.isFinite(restNum) && valueNum !== null && !/[*?]/.test(rest)) {
    return compareOp(valueNum, restNum, op)
  }
  const text = value === null ? "" : String(value).toLowerCase()
  const pat = rest.toLowerCase()
  if (op === "<>") return !wildcardMatch(text, pat)
  if (op === "=") return wildcardMatch(text, pat)
  return compareOp(text, pat, op)
}

function compareOp(left: number | string, right: number | string, op: string): boolean {
  if (op === ">") return left > right
  if (op === ">=") return left >= right
  if (op === "<") return left < right
  if (op === "<=") return left <= right
  if (op === "<>") return left !== right
  return left === right
}

function wildcardMatch(text: string, pattern: string): boolean {
  if (!/[*?]/.test(pattern)) return text === pattern
  let source = "^"
  for (const ch of pattern) {
    if (ch === "*") source += ".*"
    else if (ch === "?") source += "."
    else source += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }
  return new RegExp(`${source}$`, "i").test(text)
}

export function compareLookup(left: FormulaValue, right: FormulaValue): number {
  const a = toNumber(left)
  const b = toNumber(right)
  if (a !== null && b !== null) return a === b ? 0 : a < b ? -1 : 1
  const as = left === null ? "" : String(left).toLowerCase()
  const bs = right === null ? "" : String(right).toLowerCase()
  return as === bs ? 0 : as < bs ? -1 : 1
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30)

export function toExcelSerial(date: Date): number {
  return Math.round((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - EXCEL_EPOCH) / 86400000)
}

export function fromExcelSerial(serial: number): Date {
  return new Date(EXCEL_EPOCH + serial * 86400000)
}

function excelRound(value: number, digits: number): number {
  const factor = 10 ** digits
  const sign = value < 0 ? -1 : 1
  const scaled = Math.abs(value) * factor
  const whole = Math.floor(scaled + 1e-10)
  const fraction = scaled - whole
  const rounded = fraction >= 0.5 - 1e-10 ? whole + 1 : whole
  return (sign * rounded) / factor
}

function excelRoundAway(value: number, digits: number, up: boolean): number {
  const factor = 10 ** digits
  const scaled = value * factor
  const next = up
    ? value >= 0 ? Math.ceil(scaled - 1e-10) : Math.floor(scaled + 1e-10)
    : value >= 0 ? Math.floor(scaled + 1e-10) : Math.ceil(scaled - 1e-10)
  return next / factor
}

function formatText(value: FormulaValue, format: string): FormulaValue {
  if (isErrorValue(value)) return value
  const fmt = format.trim()
  if (/[ymd年月日]/i.test(fmt)) {
    const serial = toNumber(value)
    if (serial === null) return errorValue("#VALUE!")
    const date = fromExcelSerial(serial)
    const yyyy = String(date.getUTCFullYear())
    const m = date.getUTCMonth() + 1
    const d = date.getUTCDate()
    return fmt
      .replace(/yyyy/gi, yyyy)
      .replace(/yy/gi, yyyy.slice(-2))
      .replace(/mm/gi, String(m).padStart(2, "0"))
      .replace(/dd/gi, String(d).padStart(2, "0"))
      .replace(/m/gi, String(m))
      .replace(/d/gi, String(d))
  }
  const n = toNumber(value)
  if (n === null) return String(value ?? "")
  if (fmt.endsWith("%")) {
    const decimals = (fmt.match(/0/g) ?? []).length - 1
    return `${(n * 100).toFixed(Math.max(0, decimals))}%`
  }
  const decimals = (/\.(0+)/.exec(fmt)?.[1].length) ?? (fmt.includes(".") ? 0 : 0)
  const hasThousands = fmt.includes(",")
  const fixed = n.toFixed(decimals)
  if (!hasThousands) return fixed
  const [intPart, frac] = fixed.split(".")
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return frac !== undefined ? `${grouped}.${frac}` : grouped
}

function textOf(value: FormulaValue): string {
  if (value === null) return ""
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE"
  return String(value)
}

export const FUNCTIONS: Record<string, FormulaFn> = {
  TRUE() {
    return true
  },
  FALSE() {
    return false
  },
  SUM(args) {
    const list = requireNumbers(args)
    if (!Array.isArray(list)) return list
    return list.reduce((a, b) => a + b, 0)
  },
  AVERAGE(args) {
    const list = requireNumbers(args)
    if (!Array.isArray(list)) return list
    return list.length === 0 ? 0 : list.reduce((a, b) => a + b, 0) / list.length
  },
  MAX(args) {
    const list = requireNumbers(args)
    if (!Array.isArray(list)) return list
    return list.length === 0 ? 0 : Math.max(...list)
  },
  MIN(args) {
    const list = requireNumbers(args)
    if (!Array.isArray(list)) return list
    return list.length === 0 ? 0 : Math.min(...list)
  },
  CONCAT(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    return list.map((item) => (item === null ? "" : String(item))).join("")
  },
  NOT(args) {
    const value = flatten(args)[0] ?? false
    if (isErrorValue(value)) return value
    const bit = excelLogical(value)
    return isErrorValue(bit) ? bit : !bit
  },
  XOR(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    let count = 0
    for (const item of list) {
      const bit = excelLogical(item)
      if (isErrorValue(bit)) return bit
      if (bit) count += 1
    }
    return count % 2 === 1
  },
  ISBLANK(args) {
    const value = flatten(args)[0]
    if (isErrorValue(value)) return false
    return value === null || value === "" || value === undefined
  },
  ISERROR(args) {
    return isErrorValue(flatten(args)[0])
  },
  ISNA(args) {
    const value = flatten(args)[0]
    return isErrorValue(value) && value.error === "#N/A"
  },
  ISNUMBER(args) {
    const value = flatten(args)[0]
    return typeof value === "number" && Number.isFinite(value)
  },
  ISTEXT(args) {
    const value = flatten(args)[0]
    return typeof value === "string"
  },
  COUNT(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    return list.filter((item) => toNumber(item) !== null).length
  },
  COUNTA(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    return list.filter((item) => item !== null && item !== "").length
  },
  ROUND(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    const n = toNumber(list[0] ?? null)
    const d = toNumber(list[1] ?? 0) ?? 0
    if (n === null) return errorValue("#VALUE!")
    return excelRound(n, d)
  },
  ROUNDUP(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    const n = toNumber(list[0] ?? null)
    const d = toNumber(list[1] ?? 0) ?? 0
    if (n === null) return errorValue("#VALUE!")
    return excelRoundAway(n, d, true)
  },
  ROUNDDOWN(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    const n = toNumber(list[0] ?? null)
    const d = toNumber(list[1] ?? 0) ?? 0
    if (n === null) return errorValue("#VALUE!")
    return excelRoundAway(n, d, false)
  },
  ABS(args) {
    const value = flatten(args)[0]
    if (isErrorValue(value)) return value
    const n = toNumber(value ?? null)
    return n === null ? errorValue("#VALUE!") : Math.abs(n)
  },
  INT(args) {
    const value = flatten(args)[0]
    if (isErrorValue(value)) return value
    const n = toNumber(value ?? null)
    return n === null ? errorValue("#VALUE!") : Math.floor(n)
  },
  MOD(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    const n = toNumber(list[0] ?? null)
    const d = toNumber(list[1] ?? null)
    if (n === null || d === null) return errorValue("#VALUE!")
    if (d === 0) return errorValue("#DIV/0!")
    return n - d * Math.floor(n / d)
  },
  LEFT(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    const n = Math.max(0, Math.trunc(toNumber(list[1] ?? 1) ?? 1))
    return textOf(list[0] ?? "").slice(0, n)
  },
  RIGHT(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    const n = Math.max(0, Math.trunc(toNumber(list[1] ?? 1) ?? 1))
    const text = textOf(list[0] ?? "")
    return n === 0 ? "" : text.slice(-n)
  },
  MID(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    const start = Math.trunc(toNumber(list[1] ?? 1) ?? 1)
    const n = Math.max(0, Math.trunc(toNumber(list[2] ?? 0) ?? 0))
    if (start < 1) return errorValue("#VALUE!")
    return textOf(list[0] ?? "").slice(start - 1, start - 1 + n)
  },
  LEN(args) {
    const value = flatten(args)[0]
    if (isErrorValue(value)) return value
    return textOf(value ?? "").length
  },
  TRIM(args) {
    const value = flatten(args)[0]
    if (isErrorValue(value)) return value
    return textOf(value ?? "").trim().replace(/\s+/g, " ")
  },
  SUBSTITUTE(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    const text = textOf(list[0] ?? "")
    const old = textOf(list[1] ?? "")
    const next = textOf(list[2] ?? "")
    if (!old) return text
    const instance = list[3] === undefined ? null : Math.trunc(toNumber(list[3]) ?? 0)
    if (instance === null) return text.split(old).join(next)
    if (instance < 1) return errorValue("#VALUE!")
    let seen = 0
    return text.replaceAll(old, (chunk) => {
      seen += 1
      return seen === instance ? next : chunk
    })
  },
  TEXT(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    return formatText(list[0] ?? "", textOf(list[1] ?? "0"))
  },
  DATE(args) {
    const list = flatten(args)
    const err = firstError(list)
    if (err) return err
    const year = toNumber(list[0] ?? null)
    const month = toNumber(list[1] ?? null)
    const day = toNumber(list[2] ?? null)
    if (year === null || month === null || day === null) return errorValue("#VALUE!")
    return toExcelSerial(new Date(Date.UTC(year, month - 1, day)))
  },
  YEAR(args) {
    const serial = dateSerial(flatten(args)[0])
    return isErrorValue(serial) ? serial : fromExcelSerial(serial).getUTCFullYear()
  },
  MONTH(args) {
    const serial = dateSerial(flatten(args)[0])
    return isErrorValue(serial) ? serial : fromExcelSerial(serial).getUTCMonth() + 1
  },
  DAY(args) {
    const serial = dateSerial(flatten(args)[0])
    return isErrorValue(serial) ? serial : fromExcelSerial(serial).getUTCDate()
  },
  TODAY() {
    const now = new Date()
    return toExcelSerial(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
  },
}

function dateSerial(value: FormulaValue): number | FormulaErrorValue {
  if (isErrorValue(value)) return value
  const n = toNumber(value)
  if (n !== null) return n
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return toExcelSerial(new Date(parsed))
  }
  return errorValue("#VALUE!")
}
