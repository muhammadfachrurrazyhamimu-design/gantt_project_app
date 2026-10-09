// Critical Path Method (CPM) scheduler.
//
// Dependency semantics (lag expressed in working days, may be negative):
//   FS (Finish-to-Start) : successor.start >= predecessor.finish  + lag + 1 working day
//   SS (Start-to-Start)  : successor.start >= predecessor.start   + lag working days
//
// Tasks that own children act as *summary* tasks: they stay out of the network
// themselves and their dates are rolled up from their descendant leaves.

import type { Dependency, ProjectCalendar, Task } from '../types'
import { addWorkDays, snapToWorkingDay, workingDaysBetween } from './calendar'
import type { WorkCalendar } from './calendar'
import { minISO } from './dateUtils'

export interface TaskSchedule {
  id: string
  earlyStart: string
  earlyFinish: string
  lateStart: string
  lateFinish: string
  slackDays: number
  critical: boolean
  isSummary: boolean
  durationDays: number
}

export interface ScheduleResult {
  /** Schedule entry per task id (leaves and summaries). */
  schedule: Record<string, TaskSchedule>
  /** Leaf task ids in topological (schedule) order. */
  order: string[]
  /** Dependencies that actually connect two leaf tasks. */
  validDependencies: Dependency[]
  projectStart: string
  projectFinish: string
  /** Every critical task id. */
  criticalIds: string[]
  /** One representative critical chain, in order. */
  criticalPath: string[]
  /** Leaf tasks that could not be ordered because of a dependency cycle. */
  cycleTaskIds: string[]
  warnings: string[]
}

export interface ScheduleOptions {
  /** Optional duration override per task id (used by the PERT analysis). */
  durations?: Record<string, number>
}

function toWorkCalendar(calendar: ProjectCalendar): WorkCalendar {
  return { weekendDays: calendar.weekendDays, holidays: calendar.holidays }
}

/** Tasks with children are summaries and are not scheduled directly. */
export function summaryTaskIds(tasks: Task[]): Set<string> {
  const parents = new Set<string>()
  for (const t of tasks) {
    if (t.parentId) parents.add(t.parentId)
  }
  return parents
}

export function taskDurations(
  tasks: Task[],
  override?: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of tasks) {
    const raw = override?.[t.id] ?? t.durationDays
    out[t.id] = Math.max(1, Math.round(raw))
  }
  return out
}

export function buildsDependencyCycle(
  dependencies: Dependency[],
  predecessorId: string,
  successorId: string,
): boolean {
  // Adding pred -> succ creates a cycle iff pred is reachable from succ.
  const adj = new Map<string, string[]>()
  for (const d of dependencies) {
    const list = adj.get(d.predecessorId) ?? []
    list.push(d.successorId)
    adj.set(d.predecessorId, list)
  }
  const stack = [successorId]
  const seen = new Set<string>()
  while (stack.length) {
    const cur = stack.pop() as string
    if (cur === predecessorId) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const next of adj.get(cur) ?? []) stack.push(next)
  }
  return false
}

export function buildSchedule(
  tasks: Task[],
  dependencies: Dependency[],
  calendar: ProjectCalendar,
  options: ScheduleOptions = {},
): ScheduleResult {
  const cal = toWorkCalendar(calendar)
  const durations = taskDurations(tasks, options.durations)
  const warnings: string[] = []

  const summaryIds = summaryTaskIds(tasks)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const leaves = tasks.filter((t) => !summaryIds.has(t.id))
  const leafIds = new Set(leaves.map((t) => t.id))

  // Dependencies only ever connect leaf tasks.
  const deps = dependencies.filter(
    (d) =>
      d.predecessorId !== d.successorId &&
      leafIds.has(d.predecessorId) &&
      leafIds.has(d.successorId),
  )

  const incoming = new Map<string, Dependency[]>()
  const outgoing = new Map<string, Dependency[]>()
  const indegree = new Map<string, number>()
  for (const id of leafIds) {
    incoming.set(id, [])
    outgoing.set(id, [])
    indegree.set(id, 0)
  }
  for (const d of deps) {
    incoming.get(d.successorId)?.push(d)
    outgoing.get(d.predecessorId)?.push(d)
    indegree.set(d.successorId, (indegree.get(d.successorId) ?? 0) + 1)
  }

  // --- Kahn topological sort, keeping the input order stable ---
  const queue: string[] = leaves
    .map((t) => t.id)
    .filter((id) => (indegree.get(id) ?? 0) === 0)
  const order: string[] = []
  const queueSeen = new Set(queue)
  while (queue.length) {
    const id = queue.shift() as string
    order.push(id)
    queueSeen.delete(id)
    for (const d of outgoing.get(id) ?? []) {
      const next = (indegree.get(d.successorId) ?? 0) - 1
      indegree.set(d.successorId, next)
      if (next === 0 && !queueSeen.has(d.successorId)) {
        queue.push(d.successorId)
        queueSeen.add(d.successorId)
      }
    }
  }

  const cycleTaskIds = leaves.map((t) => t.id).filter((id) => !order.includes(id))
  if (cycleTaskIds.length) {
    warnings.push(
      `Terdeteksi siklus dependensi pada ${cycleTaskIds.length} tugas. Tugas tersebut dijadwalkan hanya dari tanggal mulainya.`,
    )
  }

  const earlyStart: Record<string, string> = {}
  const earlyFinish: Record<string, string> = {}

  const applyForward = (id: string, ignoreDependencies = false) => {
    const task = byId.get(id) as Task
    let constraint = snapToWorkingDay(task.startDate, cal)
    if (!ignoreDependencies) {
      for (const d of incoming.get(id) ?? []) {
        const predStart = earlyStart[d.predecessorId]
        const predFinish = earlyFinish[d.predecessorId]
        if (!predStart || !predFinish) continue
        const candidate =
          d.type === 'FS'
            ? addWorkDays(predFinish, (d.lagDays || 0) + 1, cal)
            : addWorkDays(predStart, d.lagDays || 0, cal)
        if (candidate > constraint) constraint = candidate
      }
    }
    earlyStart[id] = constraint
    earlyFinish[id] = addWorkDays(constraint, (durations[id] ?? 1) - 1, cal)
  }

  for (const id of order) applyForward(id)
  // Tasks inside a dependency cycle cannot be ordered; fall back to their own
  // start date and surface a warning instead of looping forever.
  for (const id of cycleTaskIds) applyForward(id, true)

  const scheduledIds = leaves.map((t) => t.id)
  const projectStart = scheduledIds.length
    ? scheduledIds.reduce((acc, id) => minISO(acc, earlyStart[id]), earlyStart[scheduledIds[0]])
    : snapToWorkingDay(calendar.projectStart, cal)
  const projectFinish = scheduledIds.length
    ? scheduledIds.reduce(
        (acc, id) => (earlyFinish[id] > acc ? earlyFinish[id] : acc),
        earlyFinish[scheduledIds[0]],
      )
    : projectStart

  // --- Backward pass, walking the reverse topological order ---
  const lfBound: Record<string, string | undefined> = {}
  const lsBoundSs: Record<string, string | undefined> = {}
  const lateStart: Record<string, string> = {}
  const lateFinish: Record<string, string> = {}
  const slackDays: Record<string, number> = {}

  const backwardOrder = [...order].reverse()
  for (const id of cycleTaskIds) if (!backwardOrder.includes(id)) backwardOrder.push(id)

  for (const id of backwardOrder) {
    const dur = durations[id] ?? 1
    const fsBound = lfBound[id]
    // Every task must finish by the project finish, so cap the late finish there.
    let lf = projectFinish
    if (fsBound && fsBound < lf) lf = fsBound

    let ls = addWorkDays(lf, -(dur - 1), cal)
    const ssBound = lsBoundSs[id]
    if (ssBound && ssBound < ls) ls = ssBound

    lateStart[id] = ls
    lateFinish[id] = addWorkDays(ls, dur - 1, cal)
    slackDays[id] = Math.max(0, workingDaysBetween(earlyStart[id], ls, cal))

    for (const d of incoming.get(id) ?? []) {
      const lag = d.lagDays || 0
      if (d.type === 'FS') {
        const cand = addWorkDays(ls, -(lag + 1), cal)
        if (!lfBound[d.predecessorId] || cand < lfBound[d.predecessorId]!) {
          lfBound[d.predecessorId] = cand
        }
      } else {
        const cand = addWorkDays(ls, -lag, cal)
        if (!lsBoundSs[d.predecessorId] || cand < lsBoundSs[d.predecessorId]!) {
          lsBoundSs[d.predecessorId] = cand
        }
      }
    }
  }

  const schedule: Record<string, TaskSchedule> = {}
  for (const id of scheduledIds) {
    schedule[id] = {
      id,
      earlyStart: earlyStart[id],
      earlyFinish: earlyFinish[id],
      lateStart: lateStart[id],
      lateFinish: lateFinish[id],
      slackDays: slackDays[id],
      critical: (slackDays[id] ?? 0) === 0,
      isSummary: false,
      durationDays: durations[id] ?? 1,
    }
  }

  // --- Roll summaries up from their descendants ---
  const childrenOf = new Map<string, string[]>()
  for (const t of tasks) {
    if (!t.parentId) continue
    const list = childrenOf.get(t.parentId) ?? []
    list.push(t.id)
    childrenOf.set(t.parentId, list)
  }

  const rollup = (id: string): TaskSchedule | undefined => {
    if (schedule[id]) return schedule[id]
    const kids = (childrenOf.get(id) ?? [])
      .map((k) => rollup(k))
      .filter((s): s is TaskSchedule => Boolean(s))
    if (!kids.length) return undefined
    const start = kids.reduce((a, k) => minISO(a, k.earlyStart), kids[0].earlyStart)
    const finish = kids.reduce(
      (a, k) => (k.earlyFinish > a ? k.earlyFinish : a),
      kids[0].earlyFinish,
    )
    const lStart = kids.reduce((a, k) => minISO(a, k.lateStart), kids[0].lateStart)
    const lFinish = kids.reduce(
      (a, k) => (k.lateFinish > a ? k.lateFinish : a),
      kids[0].lateFinish,
    )
    const slack = kids.reduce((a, k) => Math.min(a, k.slackDays), kids[0].slackDays)
    const entry: TaskSchedule = {
      id,
      earlyStart: start,
      earlyFinish: finish,
      lateStart: lStart,
      lateFinish: lFinish,
      slackDays: slack,
      critical: kids.some((k) => k.critical),
      isSummary: true,
      durationDays: Math.max(1, workingDaysBetween(start, finish, cal) + 1),
    }
    schedule[id] = entry
    return entry
  }
  for (const id of summaryIds) rollup(id)

  // --- Representative critical chain ---
  const criticalLeaves = scheduledIds.filter((id) => schedule[id].critical)
  const criticalSet = new Set(criticalLeaves)
  const hasCriticalPred = (id: string) =>
    (incoming.get(id) ?? []).some((d) => criticalSet.has(d.predecessorId))
  const starts = criticalLeaves.filter((id) => !hasCriticalPred(id))
  const path: string[] = []
  if (starts.length) {
    const first = starts.reduce((a, b) =>
      schedule[a].earlyStart <= schedule[b].earlyStart ? a : b,
    )
    let cur: string | undefined = first
    const visited = new Set<string>()
    while (cur && !visited.has(cur)) {
      visited.add(cur)
      path.push(cur)
      const nextCritical: string[] = (outgoing.get(cur) ?? [])
        .map((d) => d.successorId)
        .filter((sid) => criticalSet.has(sid))
      cur = nextCritical.length
        ? nextCritical.reduce((a, b) =>
            schedule[a].earlyStart <= schedule[b].earlyStart ? a : b,
          )
        : undefined
    }
  }

  const criticalIds = [
    ...criticalLeaves,
    ...tasks.filter((t) => schedule[t.id]?.critical && summaryIds.has(t.id)).map((t) => t.id),
  ]

  return {
    schedule,
    order,
    validDependencies: deps,
    projectStart,
    projectFinish,
    criticalIds,
    criticalPath: path,
    cycleTaskIds,
    warnings,
  }
}

/** Flatten a task list into depth-first display order with depth annotations. */
export interface FlatTask {
  task: Task
  depth: number
  childCount: number
}

export function flattenTasks(tasks: Task[]): FlatTask[] {
  const childrenOf = new Map<string, Task[]>()
  for (const t of tasks) {
    const key = t.parentId ?? '__root__'
    const list = childrenOf.get(key) ?? []
    list.push(t)
    childrenOf.set(key, list)
  }
  const out: FlatTask[] = []
  const walk = (parentId: string | null, depth: number) => {
    const kids = childrenOf.get(parentId ?? '__root__') ?? []
    for (const task of kids) {
      const childCount = (childrenOf.get(task.id) ?? []).length
      out.push({ task, depth, childCount })
      if (childCount) walk(task.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

/** Ids of a task and all of its descendants. */
export function descendantIds(tasks: Task[], rootId: string): string[] {
  const childrenOf = new Map<string, string[]>()
  for (const t of tasks) {
    if (!t.parentId) continue
    const list = childrenOf.get(t.parentId) ?? []
    list.push(t.id)
    childrenOf.set(t.parentId, list)
  }
  const out: string[] = []
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop() as string
    out.push(id)
    for (const kid of childrenOf.get(id) ?? []) stack.push(kid)
  }
  return out
}
