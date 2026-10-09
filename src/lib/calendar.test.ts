import { describe, expect, it } from 'vitest'
import {
  addWorkDays,
  countWorkingDays,
  isWorkingDay,
  nextWorkingDay,
  snapToWorkingDay,
  taskFinish,
  workingDaysBetween,
} from './calendar'
import type { WorkCalendar } from './calendar'

const cal: WorkCalendar = { weekendDays: [0, 6], holidays: [] }
const calHoliday: WorkCalendar = { weekendDays: [0, 6], holidays: ['2026-10-07'] }
// 2026-10-05 is a Monday.
const MON = '2026-10-05'

describe('isWorkingDay', () => {
  it('excludes Saturday and Sunday', () => {
    expect(isWorkingDay('2026-10-10', cal)).toBe(false) // Saturday
    expect(isWorkingDay('2026-10-11', cal)).toBe(false) // Sunday
    expect(isWorkingDay(MON, cal)).toBe(true)
  })

  it('excludes custom holidays', () => {
    expect(isWorkingDay('2026-10-07', calHoliday)).toBe(false)
    expect(isWorkingDay('2026-10-07', cal)).toBe(true)
  })

  it('honours a custom weekend configuration', () => {
    const friSat: WorkCalendar = { weekendDays: [5, 6], holidays: [] }
    expect(isWorkingDay('2026-10-09', friSat)).toBe(false) // Friday now weekend
    expect(isWorkingDay('2026-10-11', friSat)).toBe(true) // Sunday now working
  })
})

describe('snapToWorkingDay / nextWorkingDay', () => {
  it('rolls a weekend date forward to Monday', () => {
    expect(snapToWorkingDay('2026-10-10', cal)).toBe('2026-10-12')
    expect(snapToWorkingDay('2026-10-11', cal)).toBe('2026-10-12')
  })

  it('keeps working days unchanged', () => {
    expect(snapToWorkingDay(MON, cal)).toBe(MON)
  })

  it('skips the weekend going forward', () => {
    expect(nextWorkingDay('2026-10-09', cal)).toBe('2026-10-12')
  })
})

describe('addWorkDays', () => {
  it('moves forward across working days', () => {
    expect(addWorkDays(MON, 1, cal)).toBe('2026-10-06')
    expect(addWorkDays(MON, 3, cal)).toBe('2026-10-08')
    expect(addWorkDays(MON, 0, cal)).toBe(MON)
  })

  it('jumps over the weekend', () => {
    expect(addWorkDays('2026-10-09', 1, cal)).toBe('2026-10-12')
    expect(addWorkDays('2026-10-09', 2, cal)).toBe('2026-10-13')
  })

  it('moves backwards symmetrically', () => {
    expect(addWorkDays('2026-10-08', -3, cal)).toBe(MON)
    expect(addWorkDays('2026-10-12', -1, cal)).toBe('2026-10-09')
  })

  it('skips holidays', () => {
    expect(addWorkDays(MON, 2, calHoliday)).toBe('2026-10-08')
    expect(addWorkDays(MON, 3, calHoliday)).toBe('2026-10-09')
  })
})

describe('taskFinish', () => {
  it('finishes a 5 working-day task on Friday', () => {
    expect(taskFinish(MON, 5, cal)).toBe('2026-10-09')
  })

  it('extends past a holiday', () => {
    expect(taskFinish(MON, 5, calHoliday)).toBe('2026-10-12')
  })

  it('treats a 1-day task as a single working day', () => {
    expect(taskFinish(MON, 1, cal)).toBe(MON)
  })

  it('normalises a weekend start date', () => {
    expect(taskFinish('2026-10-10', 2, cal)).toBe('2026-10-13')
  })
})

describe('workingDaysBetween', () => {
  it('counts working days strictly after the start', () => {
    expect(workingDaysBetween(MON, '2026-10-09', cal)).toBe(4)
    expect(workingDaysBetween(MON, MON, cal)).toBe(0)
  })

  it('crosses weekends', () => {
    expect(workingDaysBetween(MON, '2026-10-12', cal)).toBe(5)
  })

  it('is negative when the range is reversed', () => {
    expect(workingDaysBetween('2026-10-09', MON, cal)).toBe(-4)
  })
})

describe('countWorkingDays', () => {
  it('counts inclusively and skips non-working days', () => {
    expect(countWorkingDays(MON, '2026-10-09', cal)).toBe(5)
    expect(countWorkingDays(MON, '2026-10-11', cal)).toBe(5)
    expect(countWorkingDays(MON, '2026-10-12', cal)).toBe(6)
  })

  it('returns 0 for an inverted range', () => {
    expect(countWorkingDays('2026-10-09', MON, cal)).toBe(0)
  })
})
