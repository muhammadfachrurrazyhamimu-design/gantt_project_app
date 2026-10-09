// Pure helpers behind the Gantt drag interactions, kept free of React so the
// scheduling maths can be unit tested directly.

import type { WorkCalendar } from './calendar'
import { workingDaysBetween } from './calendar'
import { addDays } from './dateUtils'

/**
 * New start date after dragging a bar `deltaCalendarDays` to the right.
 * The scheduler later snaps this onto a working day, so weekends and holidays
 * are handled by the calendar engine rather than here.
 */
export function draggedStartDate(originalStartDate: string, deltaCalendarDays: number): string {
  return addDays(originalStartDate, deltaCalendarDays)
}

/**
 * New duration in working days after dragging the *right edge* of a bar.
 * The committed finish moves by `deltaCalendarDays`, then the span is
 * re-expressed in working days so the task can never end up shorter than one
 * working day (which is what a naive "duration + delta" would produce when the
 * drag crosses a weekend).
 */
export function draggedDuration(
  scheduledStart: string,
  scheduledFinish: string,
  deltaCalendarDays: number,
  cal: WorkCalendar,
): number {
  const newFinish = addDays(scheduledFinish, deltaCalendarDays)
  const span = workingDaysBetween(scheduledStart, newFinish, cal) + 1
  return Math.max(1, span)
}

/** Days moved by one keyboard nudge, and by a coarse (Shift-held) nudge. */
export const KEYBOARD_NUDGE_DAYS = 1
export const KEYBOARD_NUDGE_COARSE_DAYS = 5

/**
 * Day delta for a keyboard nudge on a Gantt bar, or `null` when the key is not
 * a horizontal arrow (so the caller can leave other keys to the browser).
 * Shift makes the step coarser; the direction follows the arrow.
 */
export function keyboardStepDelta(key: string, coarse: boolean): number | null {
  const step = coarse ? KEYBOARD_NUDGE_COARSE_DAYS : KEYBOARD_NUDGE_DAYS
  if (key === 'ArrowRight') return step
  if (key === 'ArrowLeft') return -step
  return null
}

/** Rounds a horizontal pixel delta to whole days at the current zoom level. */
export function pixelsToDays(deltaPixels: number, dayWidth: number): number {
  if (!Number.isFinite(dayWidth) || dayWidth <= 0) return 0
  return Math.round(deltaPixels / dayWidth)
}
