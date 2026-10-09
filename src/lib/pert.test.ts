import { describe, expect, it } from 'vitest'
import type { ProjectCalendar, Task } from '../types'
import { buildPert, normalCdf, pertFor } from './pert'

const MON = '2026-10-05'

function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    name: id,
    parentId: null,
    startDate: MON,
    durationDays: 5,
    priority: 'medium',
    color: '#3b82f6',
    progress: 0,
    resourceIds: [],
    notes: '',
    optimistic: 4,
    mostLikely: 6,
    pessimistic: 14,
    ...extra,
  }
}

const calendar: ProjectCalendar = { weekendDays: [0, 6], holidays: [], projectStart: MON }

describe('pertFor', () => {
  it('computes te = (O + 4M + P) / 6', () => {
    const est = pertFor(task('A'))
    expect(est.expected).toBeCloseTo(7, 6)
  })

  it('computes variance = ((P - O) / 6)^2', () => {
    const est = pertFor(task('A'))
    expect(est.variance).toBeCloseTo(2.777777, 5)
    expect(est.stdDev).toBeCloseTo(1.666667, 5)
  })

  it('falls back to the duration when estimates are missing', () => {
    const est = pertFor(task('A', { optimistic: 0, mostLikely: 0, pessimistic: 0, durationDays: 4 }))
    expect(est.expected).toBe(4)
    expect(est.variance).toBe(0)
  })
})

describe('normalCdf', () => {
  it('is 0.5 at the mean', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
  })

  it('is monotonic', () => {
    expect(normalCdf(-1)).toBeLessThan(normalCdf(0))
    expect(normalCdf(1)).toBeGreaterThan(normalCdf(0))
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3)
  })
})

describe('buildPert', () => {
  const A = task('A') // te 7
  const B = task('B', { optimistic: 2, mostLikely: 3, pessimistic: 10 }) // te 4
  const deps = [
    { id: 'd1', predecessorId: 'A', successorId: 'B', type: 'FS' as const, lagDays: 0 },
  ]

  it('sums expected durations along the critical path', () => {
    const analysis = buildPert([A, B], deps, calendar)
    expect(analysis.expectedDuration).toBeCloseTo(11, 6)
    expect(analysis.schedule.criticalPath).toEqual(['A', 'B'])
  })

  it('sums variances along the critical path', () => {
    const analysis = buildPert([A, B], deps, calendar)
    // 2.7778 + ((10 - 2) / 6)^2 = 2.7778 + 1.7778
    expect(analysis.variance).toBeCloseTo(4.555556, 5)
    expect(analysis.stdDev).toBeCloseTo(2.134375, 5)
  })

  it('produces a probability between 0 and 1', () => {
    const analysis = buildPert([A, B], deps, calendar)
    expect(analysis.onTimeProbability).toBeGreaterThanOrEqual(0)
    expect(analysis.onTimeProbability).toBeLessThanOrEqual(1)
  })

  it('schedules with rounded expected durations', () => {
    const analysis = buildPert([A, B], deps, calendar)
    expect(analysis.schedule.schedule.A.durationDays).toBe(7)
    expect(analysis.schedule.schedule.B.durationDays).toBe(4)
  })
})
