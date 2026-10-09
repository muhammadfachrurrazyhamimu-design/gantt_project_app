import { describe, expect, it } from 'vitest'
import type { Dependency, DependencyType, ProjectCalendar, Task } from '../types'
import { buildSchedule, flattenTasks } from './schedule'

const MON = '2026-10-05'

function task(
  id: string,
  durationDays: number,
  startDate: string = MON,
  extra: Partial<Task> = {},
): Task {
  return {
    id,
    name: id,
    parentId: null,
    startDate,
    durationDays,
    priority: 'medium',
    color: '#3b82f6',
    progress: 0,
    resourceIds: [],
    notes: '',
    optimistic: durationDays,
    mostLikely: durationDays,
    pessimistic: durationDays,
    ...extra,
  }
}

function dep(
  predecessorId: string,
  successorId: string,
  type: DependencyType = 'FS',
  lagDays = 0,
): Dependency {
  return {
    id: `${predecessorId}->${successorId}:${type}:${lagDays}`,
    predecessorId,
    successorId,
    type,
    lagDays,
  }
}

const calendar: ProjectCalendar = {
  weekendDays: [0, 6],
  holidays: [],
  projectStart: MON,
}

describe('buildSchedule — Finish-to-Start', () => {
  it('starts the successor the next working day after the predecessor', () => {
    const result = buildSchedule(
      [task('A', 5), task('B', 3)],
      [dep('A', 'B')],
      calendar,
    )
    expect(result.schedule.A.earlyStart).toBe('2026-10-05')
    expect(result.schedule.A.earlyFinish).toBe('2026-10-09')
    expect(result.schedule.B.earlyStart).toBe('2026-10-12')
    expect(result.schedule.B.earlyFinish).toBe('2026-10-14')
    expect(result.projectFinish).toBe('2026-10-14')
  })

  it('marks both tasks critical when the chain drives the project', () => {
    const result = buildSchedule([task('A', 5), task('B', 3)], [dep('A', 'B')], calendar)
    expect(result.schedule.A.critical).toBe(true)
    expect(result.schedule.B.critical).toBe(true)
    expect(result.criticalPath).toEqual(['A', 'B'])
  })

  it('applies positive lag in working days', () => {
    const result = buildSchedule(
      [task('A', 5), task('B', 3)],
      [dep('A', 'B', 'FS', 2)],
      calendar,
    )
    // A finishes Fri 09 Oct; +2 working days of lag => Wed 14 Oct.
    expect(result.schedule.B.earlyStart).toBe('2026-10-14')
    expect(result.schedule.B.earlyFinish).toBe('2026-10-16')
  })

  it('supports negative lag (overlap)', () => {
    const result = buildSchedule(
      [task('A', 5), task('B', 3)],
      [dep('A', 'B', 'FS', -2)],
      calendar,
    )
    // A finishes Fri 09 Oct; lag -2 pulls the start back 2 working days to Thu 08 Oct.
    expect(result.schedule.B.earlyStart).toBe('2026-10-08')
    expect(result.schedule.B.earlyFinish).toBe('2026-10-12')
  })
})

describe('buildSchedule — Start-to-Start', () => {
  it('anchors the successor start to the predecessor start', () => {
    const result = buildSchedule(
      [task('A', 5), task('B', 3)],
      [dep('A', 'B', 'SS', 0)],
      calendar,
    )
    expect(result.schedule.B.earlyStart).toBe('2026-10-05')
    expect(result.schedule.B.earlyFinish).toBe('2026-10-07')
  })

  it('applies SS lag', () => {
    const result = buildSchedule(
      [task('A', 5), task('B', 3)],
      [dep('A', 'B', 'SS', 1)],
      calendar,
    )
    expect(result.schedule.B.earlyStart).toBe('2026-10-06')
    expect(result.schedule.B.earlyFinish).toBe('2026-10-08')
  })
})

describe('buildSchedule — slack and critical path', () => {
  it('gives the shorter parallel branch positive slack', () => {
    const result = buildSchedule(
      [task('A', 5), task('B', 3), task('C', 2)],
      [dep('A', 'B'), dep('A', 'C')],
      calendar,
    )
    expect(result.projectFinish).toBe('2026-10-14')
    expect(result.schedule.B.slackDays).toBe(0)
    expect(result.schedule.B.critical).toBe(true)
    expect(result.schedule.C.slackDays).toBe(1)
    expect(result.schedule.C.critical).toBe(false)
    expect(result.criticalPath).toEqual(['A', 'B'])
  })

  it('treats a task starting later than required as constrained by its start date', () => {
    const result = buildSchedule(
      [task('A', 3, '2026-10-05'), task('B', 3, '2026-10-20')],
      [],
      calendar,
    )
    expect(result.schedule.A.earlyStart).toBe('2026-10-05')
    expect(result.schedule.B.earlyStart).toBe('2026-10-20')
    expect(result.projectStart).toBe('2026-10-05')
    expect(result.projectFinish).toBe('2026-10-22')
  })
})

describe('buildSchedule — calendar awareness', () => {
  it('pushes the finish date past a custom holiday', () => {
    const withHoliday: ProjectCalendar = {
      ...calendar,
      holidays: ['2026-10-07'],
    }
    const result = buildSchedule([task('A', 5)], [], withHoliday)
    expect(result.schedule.A.earlyFinish).toBe('2026-10-12')
  })

  it('recomputes when Sunday becomes a working day', () => {
    const sixDay: ProjectCalendar = { ...calendar, weekendDays: [0] }
    const result = buildSchedule([task('A', 6)], [], sixDay)
    // Mon..Sat inclusive => Saturday 10 Oct (Sunday is the only rest day).
    expect(result.schedule.A.earlyFinish).toBe('2026-10-10')
  })
})

describe('buildSchedule — structure', () => {
  it('rolls summary tasks up from their children', () => {
    const tasks = [
      task('P', 1, MON, { parentId: null }),
      task('C1', 3, '2026-10-05', { parentId: 'P' }),
      task('C2', 2, '2026-10-08', { parentId: 'P' }),
    ]
    const result = buildSchedule(tasks, [], calendar)
    expect(result.schedule.P.isSummary).toBe(true)
    expect(result.schedule.P.earlyStart).toBe('2026-10-05')
    expect(result.schedule.P.earlyFinish).toBe('2026-10-09')
    expect(result.schedule.P.durationDays).toBe(5)
  })

  it('ignores dependencies that involve summary tasks', () => {
    const tasks = [
      task('P', 1, MON, { parentId: null }),
      task('C1', 3, '2026-10-05', { parentId: 'P' }),
      task('X', 2, '2026-10-05'),
    ]
    const result = buildSchedule(tasks, [dep('P', 'X')], calendar)
    expect(result.validDependencies).toHaveLength(0)
    // X is unaffected by the ignored dependency.
    expect(result.schedule.X.earlyStart).toBe('2026-10-05')
  })

  it('reports dependency cycles instead of hanging', () => {
    const result = buildSchedule(
      [task('A', 2), task('B', 2)],
      [dep('A', 'B'), dep('B', 'A')],
      calendar,
    )
    expect(result.cycleTaskIds.sort()).toEqual(['A', 'B'])
    expect(result.warnings.length).toBeGreaterThan(0)
    // Cycling tasks fall back to their own start dates.
    expect(result.schedule.A.earlyStart).toBe('2026-10-05')
    expect(result.schedule.B.earlyStart).toBe('2026-10-05')
  })

  it('ignores self-referencing dependencies', () => {
    const result = buildSchedule([task('A', 2)], [dep('A', 'A')], calendar)
    expect(result.validDependencies).toHaveLength(0)
  })
})

describe('flattenTasks', () => {
  it('returns depth-first order with depth and child counts', () => {
    const tasks = [
      task('P', 1),
      task('C1', 1, MON, { parentId: 'P' }),
      task('C2', 1, MON, { parentId: 'P' }),
      task('Q', 1),
    ]
    const flat = flattenTasks(tasks)
    expect(flat.map((f) => f.task.id)).toEqual(['P', 'C1', 'C2', 'Q'])
    expect(flat[0]).toMatchObject({ depth: 0, childCount: 2 })
    expect(flat[1]).toMatchObject({ depth: 1, childCount: 0 })
  })
})
