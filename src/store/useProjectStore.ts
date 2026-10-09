import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Dependency,
  ProjectCalendar,
  ProjectData,
  Resource,
  Task,
} from '../types'
import { createSampleProject, uid } from '../lib/sample'
import { buildSchedule, summaryTaskIds } from '../lib/schedule'
import type { ScheduleResult } from '../lib/schedule'
import { useMemo } from 'react'

export interface ProjectStore extends ProjectData {
  selectedTaskId: string | null
  selectTask: (id: string | null) => void

  setName: (name: string) => void

  addTask: (partial?: Partial<Task>) => string
  addSubtask: (parentId: string) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  moveTask: (id: string, direction: 'up' | 'down') => void

  addDependency: (input: Omit<Dependency, 'id'>) => void
  updateDependency: (id: string, patch: Partial<Dependency>) => void
  deleteDependency: (id: string) => void

  addResource: (partial?: Partial<Resource>) => string
  updateResource: (id: string, patch: Partial<Resource>) => void
  deleteResource: (id: string) => void

  updateCalendar: (patch: Partial<ProjectCalendar>) => void
  toggleWeekendDay: (day: number) => void
  addHoliday: (iso: string) => void
  removeHoliday: (iso: string) => void

  importData: (data: ProjectData) => void
  resetToSample: () => void
  clearAll: () => void
}

const PALETTE = [
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
  '#0ea5e9',
]

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids))
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      ...createSampleProject(),
      selectedTaskId: null,

      selectTask: (id) => set({ selectedTaskId: id }),
      setName: (name) => set({ name }),

      addTask: (partial) => {
        const state = get()
        const id = uid('task')
        const parentId = partial?.parentId ?? null
        const task: Task = {
          id,
          name: partial?.name ?? 'Tugas Baru',
          parentId,
          startDate:
            partial?.startDate ?? state.calendar.projectStart,
          durationDays: partial?.durationDays ?? 3,
          priority: partial?.priority ?? 'medium',
          color: partial?.color ?? PALETTE[state.tasks.length % PALETTE.length],
          progress: partial?.progress ?? 0,
          resourceIds: partial?.resourceIds ?? [],
          notes: partial?.notes ?? '',
          optimistic: partial?.optimistic ?? partial?.durationDays ?? 3,
          mostLikely: partial?.mostLikely ?? partial?.durationDays ?? 3,
          pessimistic: partial?.pessimistic ?? partial?.durationDays ?? 3,
        }
        set({ tasks: [...state.tasks, task], selectedTaskId: id })
        return id
      },

      addSubtask: (parentId) => {
        const state = get()
        const parent = state.tasks.find((t) => t.id === parentId)
        const id = uid('task')
        const task: Task = {
          id,
          name: 'Sub-tugas Baru',
          parentId,
          startDate: parent?.startDate ?? state.calendar.projectStart,
          durationDays: 2,
          priority: parent?.priority ?? 'medium',
          color: parent?.color ?? PALETTE[state.tasks.length % PALETTE.length],
          progress: 0,
          resourceIds: [],
          notes: '',
          optimistic: 2,
          mostLikely: 2,
          pessimistic: 2,
        }
        // Insert the child right after its parent's existing children.
        const parentIndex = state.tasks.findIndex((t) => t.id === parentId)
        const cut = parentIndex < 0 ? state.tasks.length : parentIndex + 1
        const next = [...state.tasks]
        next.splice(cut, 0, task)
        set({ tasks: next, selectedTaskId: id })
        return id
      },

      updateTask: (id, patch) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      deleteTask: (id) => {
        const state = get()
        const remove = new Set<string>([id])
        let grew = true
        while (grew) {
          grew = false
          for (const t of state.tasks) {
            if (t.parentId && remove.has(t.parentId) && !remove.has(t.id)) {
              remove.add(t.id)
              grew = true
            }
          }
        }
        set({
          tasks: state.tasks.filter((t) => !remove.has(t.id)),
          dependencies: state.dependencies.filter(
            (d) => !remove.has(d.predecessorId) && !remove.has(d.successorId),
          ),
          selectedTaskId: state.selectedTaskId && remove.has(state.selectedTaskId)
            ? null
            : state.selectedTaskId,
        })
      },

      moveTask: (id, direction) => {
        const state = get()
        const index = state.tasks.findIndex((t) => t.id === id)
        if (index < 0) return
        const target = direction === 'up' ? index - 1 : index + 1
        if (target < 0 || target >= state.tasks.length) return
        const next = [...state.tasks]
        const tmp = next[index]
        next[index] = next[target]
        next[target] = tmp
        set({ tasks: next })
      },

      addDependency: (input) => {
        const state = get()
        if (input.predecessorId === input.successorId) return
        const exists = state.dependencies.some(
          (d) =>
            d.predecessorId === input.predecessorId &&
            d.successorId === input.successorId &&
            d.type === input.type,
        )
        if (exists) return
        set({
          dependencies: [...state.dependencies, { ...input, id: uid('dep') }],
        })
      },

      updateDependency: (id, patch) =>
        set((state) => ({
          dependencies: state.dependencies.map((d) =>
            d.id === id ? { ...d, ...patch } : d,
          ),
        })),

      deleteDependency: (id) =>
        set((state) => ({
          dependencies: state.dependencies.filter((d) => d.id !== id),
        })),

      addResource: (partial) => {
        const id = uid('res')
        const resource: Resource = {
          id,
          name: partial?.name ?? 'Anggota Baru',
          email: partial?.email ?? '',
          role: partial?.role ?? 'Staff',
          salary: partial?.salary ?? 10_000_000,
        }
        set((state) => ({ resources: [...state.resources, resource] }))
        return id
      },

      updateResource: (id, patch) =>
        set((state) => ({
          resources: state.resources.map((r) =>
            r.id === id ? { ...r, ...patch } : r,
          ),
        })),

      deleteResource: (id) =>
        set((state) => ({
          resources: state.resources.filter((r) => r.id !== id),
          tasks: state.tasks.map((t) => ({
            ...t,
            resourceIds: t.resourceIds.filter((rid) => rid !== id),
          })),
        })),

      updateCalendar: (patch) =>
        set((state) => ({ calendar: { ...state.calendar, ...patch } })),

      toggleWeekendDay: (day) =>
        set((state) => {
          const has = state.calendar.weekendDays.includes(day)
          const weekendDays = has
            ? state.calendar.weekendDays.filter((d) => d !== day)
            : [...state.calendar.weekendDays, day].sort((a, b) => a - b)
          return { calendar: { ...state.calendar, weekendDays } }
        }),

      addHoliday: (iso) =>
        set((state) => ({
          calendar: {
            ...state.calendar,
            holidays: uniqueIds([...state.calendar.holidays, iso]).sort(),
          },
        })),

      removeHoliday: (iso) =>
        set((state) => ({
          calendar: {
            ...state.calendar,
            holidays: state.calendar.holidays.filter((h) => h !== iso),
          },
        })),

      importData: (data) =>
        set({
          name: data.name,
          tasks: data.tasks,
          dependencies: data.dependencies,
          resources: data.resources,
          calendar: data.calendar,
          selectedTaskId: null,
        }),

      resetToSample: () => set({ ...createSampleProject(), selectedTaskId: null }),

      clearAll: () =>
        set((state) => ({
          tasks: [],
          dependencies: [],
          resources: state.resources,
          selectedTaskId: null,
        })),
    }),
    {
      name: 'gantt-project-v1',
      partialize: (state) => ({
        name: state.name,
        tasks: state.tasks,
        dependencies: state.dependencies,
        resources: state.resources,
        calendar: state.calendar,
      }),
    },
  ),
)

/** Reactive CPM schedule derived from the store. */
export function useSchedule(): ScheduleResult {
  const tasks = useProjectStore((s) => s.tasks)
  const dependencies = useProjectStore((s) => s.dependencies)
  const calendar = useProjectStore((s) => s.calendar)
  return useMemo(
    () => buildSchedule(tasks, dependencies, calendar),
    [tasks, dependencies, calendar],
  )
}

export function useSummaryIds(): Set<string> {
  const tasks = useProjectStore((s) => s.tasks)
  return useMemo(() => summaryTaskIds(tasks), [tasks])
}

export function useResourceMap(): Map<string, Resource> {
  const resources = useProjectStore((s) => s.resources)
  return useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources])
}
