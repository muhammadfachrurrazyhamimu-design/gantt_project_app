// Working-day calendar: answers "is this a working day?" and does
// working-day arithmetic that skips weekends (configurable) and holidays.

import { addDays, dayOfWeek } from './dateUtils'

export interface WorkCalendar {
  weekendDays: number[]
  holidays: string[]
}

const MAX_SCAN = 4000

export function isWeekend(iso: string, cal: WorkCalendar): boolean {
  return cal.weekendDays.includes(dayOfWeek(iso))
}

export function isHoliday(iso: string, cal: WorkCalendar): boolean {
  return cal.holidays.includes(iso)
}

export function isWorkingDay(iso: string, cal: WorkCalendar): boolean {
  return !isWeekend(iso, cal) && !isHoliday(iso, cal)
}

/** First working day strictly after `iso`. */
export function nextWorkingDay(iso: string, cal: WorkCalendar): string {
  let d = addDays(iso, 1)
  let guard = 0
  while (!isWorkingDay(d, cal) && guard++ < MAX_SCAN) d = addDays(d, 1)
  return d
}

/** Last working day strictly before `iso`. */
export function prevWorkingDay(iso: string, cal: WorkCalendar): string {
  let d = addDays(iso, -1)
  let guard = 0
  while (!isWorkingDay(d, cal) && guard++ < MAX_SCAN) d = addDays(d, -1)
  return d
}

/** If `iso` is a holiday/weekend, roll forward to the next working day. */
export function snapToWorkingDay(iso: string, cal: WorkCalendar): string {
  let d = iso
  let guard = 0
  while (!isWorkingDay(d, cal) && guard++ < MAX_SCAN) d = addDays(d, 1)
  return d
}

/**
 * Move `n` working days from `iso`.
 * `addWorkDays(d, 0)` returns `d` when it is a working day (else the next one).
 * Negative `n` walks backwards (snapping to the previous working day first).
 */
export function addWorkDays(iso: string, n: number, cal: WorkCalendar): string {
  if (n === 0) return snapToWorkingDay(iso, cal)
  let cur: string
  let remaining: number
  if (n > 0) {
    cur = snapToWorkingDay(iso, cal)
    remaining = n
    while (remaining-- > 0) cur = nextWorkingDay(cur, cal)
  } else {
    cur = isWorkingDay(iso, cal) ? iso : prevWorkingDay(iso, cal)
    remaining = -n
    while (remaining-- > 0) cur = prevWorkingDay(cur, cal)
  }
  return cur
}

/**
 * Number of working days strictly after `a` and up to and including `b`.
 * Returns a negative value when `b < a`.
 */
export function workingDaysBetween(a: string, b: string, cal: WorkCalendar): number {
  if (a === b) return 0
  if (b < a) return -workingDaysBetween(b, a, cal)
  let count = 0
  let cur = a
  let guard = 0
  while (cur < b && guard++ < MAX_SCAN) {
    cur = nextWorkingDay(cur, cal)
    if (cur <= b) count++
  }
  return count
}

/** Inclusive list of working days for a task starting at `start` for `duration` days. */
export function workingDaysOf(
  start: string,
  duration: number,
  cal: WorkCalendar,
): string[] {
  const first = snapToWorkingDay(start, cal)
  const last = addWorkDays(first, Math.max(1, Math.round(duration)) - 1, cal)
  const out: string[] = []
  let cur = first
  let guard = 0
  while (cur <= last && guard++ < MAX_SCAN) {
    if (isWorkingDay(cur, cal)) out.push(cur)
    cur = nextWorkingDay(cur, cal)
  }
  return out
}

/** Last working day occupied by a task of `duration` working days starting at `start`. */
export function taskFinish(start: string, duration: number, cal: WorkCalendar): string {
  const first = snapToWorkingDay(start, cal)
  return addWorkDays(first, Math.max(1, Math.round(duration)) - 1, cal)
}

/** Count of working days inside the inclusive [start, end] range. */
export function countWorkingDays(start: string, end: string, cal: WorkCalendar): number {
  if (end < start) return 0
  let count = 0
  let cur = start
  let guard = 0
  while (cur <= end && guard++ < MAX_SCAN) {
    if (isWorkingDay(cur, cal)) count++
    cur = addDays(cur, 1)
  }
  return count
}
