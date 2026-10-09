// PERT (Program Evaluation and Review Technique) analysis.
//
// Each task carries three-point estimates in working days:
//   optimistic (o), most likely (m), pessimistic (p)
//   expected te = (o + 4m + p) / 6
//   variance   = ((p - o) / 6)^2

import type { Dependency, ProjectCalendar, Task } from '../types'
import { buildSchedule } from './schedule'
import type { ScheduleResult } from './schedule'

export interface PertEstimate {
  id: string
  optimistic: number
  mostLikely: number
  pessimistic: number
  expected: number
  variance: number
  stdDev: number
}

export interface PertAnalysis {
  estimates: Record<string, PertEstimate>
  /** Schedule computed using expected (te) durations. */
  schedule: ScheduleResult
  expectedDuration: number
  variance: number
  stdDev: number
  /** Probability of finishing at or before the deterministic duration. */
  onTimeProbability: number
}

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26, accurate to ~1e-7.
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax)
  return sign * y
}

/** Standard normal CDF. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

export function pertFor(task: Task): PertEstimate {
  const o = task.optimistic > 0 ? task.optimistic : task.durationDays
  const m = task.mostLikely > 0 ? task.mostLikely : task.durationDays
  const p = task.pessimistic > 0 ? task.pessimistic : task.durationDays
  const expected = (o + 4 * m + p) / 6
  const variance = ((p - o) / 6) ** 2
  return {
    id: task.id,
    optimistic: o,
    mostLikely: m,
    pessimistic: p,
    expected,
    variance,
    stdDev: Math.sqrt(variance),
  }
}

export function buildPert(
  tasks: Task[],
  dependencies: Dependency[],
  calendar: ProjectCalendar,
): PertAnalysis {
  const estimates: Record<string, PertEstimate> = {}
  const durations: Record<string, number> = {}
  for (const task of tasks) {
    const est = pertFor(task)
    estimates[task.id] = est
    durations[task.id] = Math.max(1, Math.round(est.expected))
  }

  const schedule = buildSchedule(tasks, dependencies, calendar, { durations })

  const chain = schedule.criticalPath.length
    ? schedule.criticalPath
    : schedule.criticalIds
  let expectedDuration = 0
  let variance = 0
  for (const id of chain) {
    const est = estimates[id]
    if (!est) continue
    expectedDuration += est.expected
    variance += est.variance
  }
  const stdDev = Math.sqrt(variance)

  // Deterministic duration along the same chain, for the on-time probability.
  const deterministic = chain.reduce((sum, id) => {
    const task = tasks.find((t) => t.id === id)
    return sum + (task ? Math.max(1, task.durationDays) : 0)
  }, 0)

  const z = stdDev > 0 ? (deterministic - expectedDuration) / stdDev : 0
  const onTimeProbability = Number.isFinite(z) ? normalCdf(z) : 1

  return {
    estimates,
    schedule,
    expectedDuration,
    variance,
    stdDev,
    onTimeProbability,
  }
}
