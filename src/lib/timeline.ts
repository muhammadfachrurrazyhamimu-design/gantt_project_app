import { MONTH_SHORT, WEEKDAY_LABELS } from '../types'
import { eachDay, dayOfWeek } from './dateUtils'
import type { WorkCalendar } from './calendar'
import { isHoliday, isWeekend, isWorkingDay } from './calendar'

export interface TimelineDay {
  iso: string
  dayNum: number
  dow: number
  dowLabel: string
  working: boolean
  weekend: boolean
  holiday: boolean
  today: boolean
  monthKey: string
}

export interface TimelineMonth {
  key: string
  label: string
  days: number
}

export interface Timeline {
  start: string
  end: string
  days: TimelineDay[]
  months: TimelineMonth[]
  width: number
  dayWidth: number
}

export function buildTimeline(
  start: string,
  end: string,
  cal: WorkCalendar,
  dayWidth: number,
  today: string,
): Timeline {
  const days: TimelineDay[] = eachDay(start, end).map((iso) => {
    const dow = dayOfWeek(iso)
    return {
      iso,
      dayNum: Number(iso.slice(8, 10)),
      dow,
      dowLabel: WEEKDAY_LABELS[dow],
      working: isWorkingDay(iso, cal),
      weekend: isWeekend(iso, cal),
      holiday: isHoliday(iso, cal),
      today: iso === today,
      monthKey: iso.slice(0, 7),
    }
  })

  const months: TimelineMonth[] = []
  for (const day of days) {
    const last = months[months.length - 1]
    if (last && last.key === day.monthKey) {
      last.days += 1
    } else {
      const [year, month] = day.monthKey.split('-')
      months.push({
        key: day.monthKey,
        label: `${MONTH_SHORT[Number(month) - 1]} ${year}`,
        days: 1,
      })
    }
  }

  return {
    start,
    end,
    days,
    months,
    dayWidth,
    width: days.length * dayWidth,
  }
}

/** Start/end (week aligned) covering every scheduled task plus project bounds. */
export function computeTimelineBounds(
  starts: string[],
  finishes: string[],
  fallbackStart: string,
  fallbackFinish: string,
): { start: string; end: string } {
  return {
    start: starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : fallbackStart,
    end: finishes.length ? finishes.reduce((a, b) => (a > b ? a : b)) : fallbackFinish,
  }
}
