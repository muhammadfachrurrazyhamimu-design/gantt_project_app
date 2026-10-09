import { describe, expect, it } from 'vitest'
import {
  draggedDuration,
  draggedStartDate,
  keyboardStepDelta,
  pixelsToDays,
} from './dragUtils'
import type { WorkCalendar } from './calendar'

const cal: WorkCalendar = { weekendDays: [0, 6], holidays: [] }
const withHoliday: WorkCalendar = { weekendDays: [0, 6], holidays: ['2026-10-07'] }
// 2026-10-05 is a Monday, 2026-10-09 a Friday.

describe('draggedStartDate', () => {
  it('returns the same date for a zero drag', () => {
    expect(draggedStartDate('2026-10-05', 0)).toBe('2026-10-05')
  })

  it('shifts by whole calendar days in both directions', () => {
    expect(draggedStartDate('2026-10-05', 3)).toBe('2026-10-08')
    expect(draggedStartDate('2026-10-05', -3)).toBe('2026-10-02')
  })

  it('may land on a weekend — the scheduler snaps it later', () => {
    expect(draggedStartDate('2026-10-05', 5)).toBe('2026-10-10')
  })
})

describe('draggedDuration', () => {
  it('keeps the duration when nothing was dragged', () => {
    expect(draggedDuration('2026-10-05', '2026-10-09', 0, cal)).toBe(5)
  })

  it('grows the duration when dragging the right edge outward', () => {
    // Fri 09 Oct + 3 calendar days => Mon 12 Oct => 6 working days.
    expect(draggedDuration('2026-10-05', '2026-10-09', 3, cal)).toBe(6)
  })

  it('shrinks the duration when dragging the right edge inward', () => {
    expect(draggedDuration('2026-10-05', '2026-10-09', -2, cal)).toBe(3)
  })

  it('does not add a working day when the edge lands on a weekend', () => {
    // +1 calendar day => Sat 10 Oct, which is not a working day.
    expect(draggedDuration('2026-10-05', '2026-10-09', 1, cal)).toBe(5)
  })

  it('never produces a duration below one working day', () => {
    expect(draggedDuration('2026-10-05', '2026-10-09', -40, cal)).toBe(1)
  })

  it('respects custom holidays inside the span', () => {
    // 07 Oct is a holiday, so the same dates span one working day less.
    expect(draggedDuration('2026-10-05', '2026-10-09', 0, withHoliday)).toBe(4)
  })
})

describe('pixelsToDays', () => {
  it('rounds to the nearest whole day', () => {
    expect(pixelsToDays(26, 26)).toBe(1)
    expect(pixelsToDays(52, 26)).toBe(2)
    expect(pixelsToDays(12, 26)).toBe(0)
    expect(pixelsToDays(-30, 26)).toBe(-1)
  })

  it('is safe for a degenerate zoom level', () => {
    expect(pixelsToDays(50, 0)).toBe(0)
  })
})

describe('keyboardStepDelta', () => {
  it('moves one day per arrow press', () => {
    expect(keyboardStepDelta('ArrowRight', false)).toBe(1)
    expect(keyboardStepDelta('ArrowLeft', false)).toBe(-1)
  })

  it('moves a coarser five days when Shift is held', () => {
    expect(keyboardStepDelta('ArrowRight', true)).toBe(5)
    expect(keyboardStepDelta('ArrowLeft', true)).toBe(-5)
  })

  it('ignores vertical arrows and other keys', () => {
    expect(keyboardStepDelta('ArrowUp', false)).toBeNull()
    expect(keyboardStepDelta('ArrowDown', true)).toBeNull()
    expect(keyboardStepDelta('Enter', false)).toBeNull()
  })
})
