// Timezone-safe helpers that operate on ISO date strings (yyyy-mm-dd).
// All arithmetic uses UTC midnight so daylight-saving shifts never leak in.

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidISO(value: string): boolean {
  if (!ISO_RE.test(value)) return false
  const d = parseISO(value)
  return toISO(d) === value
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

export function toISO(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return toISO(d)
}

/** 0 = Sunday ... 6 = Saturday */
export function dayOfWeek(iso: string): number {
  return parseISO(iso).getUTCDay()
}

export function compareISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function minISO(a: string, b: string): string {
  return a <= b ? a : b
}

export function maxISO(a: string, b: string): string {
  return a >= b ? a : b
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000)
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = []
  if (compareISO(start, end) > 0) return out
  let cur = start
  // Safety valve against runaway loops on malformed input.
  let guard = 0
  while (compareISO(cur, end) <= 0 && guard++ < 20_000) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

export function todayISO(): string {
  const now = new Date()
  return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

/** Monday-based start of the week containing `iso`. */
export function startOfWeek(iso: string, firstDay = 1): string {
  const dow = dayOfWeek(iso)
  const delta = (dow - firstDay + 7) % 7
  return addDays(iso, -delta)
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function endOfMonth(iso: string): string {
  const d = parseISO(iso)
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))
}
