import type { Dependency, ProjectData, Resource, Task } from '../types'
import { addDays, startOfWeek, todayISO } from './dateUtils'

export function uid(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${rand}`
}

interface TaskSeed {
  id: string
  name: string
  parentId: string | null
  durationDays: number
  priority: Task['priority']
  color: string
  progress: number
  resourceIds: string[]
  offset?: number
  notes?: string
  optimistic?: number
  pessimistic?: number
}

export function createSampleProject(): ProjectData {
  const projectStart = startOfWeek(todayISO(), 1)

  const resources: Resource[] = [
    {
      id: 'res-1',
      name: 'Andi Pratama',
      email: 'andi@example.com',
      role: 'Project Manager',
      salary: 22_000_000,
    },
    {
      id: 'res-2',
      name: 'Siti Nurhaliza',
      email: 'siti@example.com',
      role: 'Business Analyst',
      salary: 17_500_000,
    },
    {
      id: 'res-3',
      name: 'Budi Santoso',
      email: 'budi@example.com',
      role: 'Backend Engineer',
      salary: 19_000_000,
    },
    {
      id: 'res-4',
      name: 'Citra Dewi',
      email: 'citra@example.com',
      role: 'Frontend Engineer',
      salary: 18_000_000,
    },
    {
      id: 'res-5',
      name: 'Eko Wijaya',
      email: 'eko@example.com',
      role: 'QA Engineer',
      salary: 14_500_000,
    },
    {
      id: 'res-6',
      name: 'Rani Kartika',
      email: 'rani@example.com',
      role: 'UI/UX Designer',
      salary: 16_000_000,
    },
  ]

  const seeds: TaskSeed[] = [
    {
      id: 't-1',
      name: 'Inisiasi Proyek',
      parentId: null,
      durationDays: 1,
      priority: 'high',
      color: '#6366f1',
      progress: 100,
      resourceIds: [],
    },
    {
      id: 't-1-1',
      name: 'Analisis kebutuhan',
      parentId: 't-1',
      durationDays: 5,
      priority: 'high',
      color: '#6366f1',
      progress: 100,
      resourceIds: ['res-2'],
      notes: 'Wawancara stakeholder & penyusunan user story.',
      optimistic: 4,
      pessimistic: 8,
    },
    {
      id: 't-1-2',
      name: 'Studi kelayakan teknis',
      parentId: 't-1',
      durationDays: 4,
      priority: 'medium',
      color: '#6366f1',
      progress: 100,
      resourceIds: ['res-3'],
      optimistic: 3,
      pessimistic: 6,
    },
    {
      id: 't-1-3',
      name: 'Penyusunan proposal',
      parentId: 't-1',
      durationDays: 3,
      priority: 'medium',
      color: '#6366f1',
      progress: 100,
      resourceIds: ['res-1', 'res-2'],
      optimistic: 2,
      pessimistic: 5,
    },
    {
      id: 't-2',
      name: 'Desain Sistem',
      parentId: null,
      durationDays: 1,
      priority: 'high',
      color: '#0ea5e9',
      progress: 60,
      resourceIds: [],
    },
    {
      id: 't-2-1',
      name: 'Arsitektur sistem',
      parentId: 't-2',
      durationDays: 4,
      priority: 'critical',
      color: '#0ea5e9',
      progress: 100,
      resourceIds: ['res-3'],
      optimistic: 3,
      pessimistic: 7,
    },
    {
      id: 't-2-2',
      name: 'Desain UI/UX',
      parentId: 't-2',
      durationDays: 6,
      priority: 'high',
      color: '#0ea5e9',
      progress: 50,
      resourceIds: ['res-6'],
      optimistic: 4,
      pessimistic: 10,
    },
    {
      id: 't-2-3',
      name: 'Desain database',
      parentId: 't-2',
      durationDays: 3,
      priority: 'medium',
      color: '#0ea5e9',
      progress: 30,
      resourceIds: ['res-3'],
      optimistic: 2,
      pessimistic: 5,
    },
    {
      id: 't-3',
      name: 'Pengembangan',
      parentId: null,
      durationDays: 1,
      priority: 'critical',
      color: '#22c55e',
      progress: 25,
      resourceIds: [],
    },
    {
      id: 't-3-1',
      name: 'Setup lingkungan & CI/CD',
      parentId: 't-3',
      durationDays: 2,
      priority: 'medium',
      color: '#22c55e',
      progress: 100,
      resourceIds: ['res-3'],
      optimistic: 1,
      pessimistic: 4,
    },
    {
      id: 't-3-2',
      name: 'Backend API',
      parentId: 't-3',
      durationDays: 10,
      priority: 'critical',
      color: '#22c55e',
      progress: 40,
      resourceIds: ['res-3'],
      optimistic: 8,
      pessimistic: 16,
    },
    {
      id: 't-3-3',
      name: 'Frontend aplikasi',
      parentId: 't-3',
      durationDays: 12,
      priority: 'critical',
      color: '#22c55e',
      progress: 15,
      resourceIds: ['res-4'],
      optimistic: 10,
      pessimistic: 20,
    },
    {
      id: 't-3-4',
      name: 'Integrasi modul',
      parentId: 't-3',
      durationDays: 5,
      priority: 'high',
      color: '#22c55e',
      progress: 0,
      resourceIds: ['res-3', 'res-4'],
      optimistic: 4,
      pessimistic: 9,
    },
    {
      id: 't-4',
      name: 'Pengujian',
      parentId: null,
      durationDays: 1,
      priority: 'high',
      color: '#f59e0b',
      progress: 0,
      resourceIds: [],
    },
    {
      id: 't-4-1',
      name: 'Uji fungsional',
      parentId: 't-4',
      durationDays: 6,
      priority: 'high',
      color: '#f59e0b',
      progress: 0,
      resourceIds: ['res-5'],
      optimistic: 5,
      pessimistic: 12,
    },
    {
      id: 't-4-2',
      name: 'User Acceptance Test',
      parentId: 't-4',
      durationDays: 4,
      priority: 'high',
      color: '#f59e0b',
      progress: 0,
      resourceIds: ['res-5', 'res-2'],
      optimistic: 3,
      pessimistic: 8,
    },
    {
      id: 't-5',
      name: 'Peluncuran',
      parentId: null,
      durationDays: 1,
      priority: 'medium',
      color: '#ec4899',
      progress: 0,
      resourceIds: [],
    },
    {
      id: 't-5-1',
      name: 'Deployment produksi',
      parentId: 't-5',
      durationDays: 2,
      priority: 'critical',
      color: '#ec4899',
      progress: 0,
      resourceIds: ['res-3'],
      optimistic: 1,
      pessimistic: 4,
    },
    {
      id: 't-5-2',
      name: 'Pelatihan pengguna',
      parentId: 't-5',
      durationDays: 3,
      priority: 'medium',
      color: '#ec4899',
      progress: 0,
      resourceIds: ['res-2', 'res-1'],
      optimistic: 2,
      pessimistic: 6,
    },
  ]

  const tasks: Task[] = seeds.map((s) => ({
    id: s.id,
    name: s.name,
    parentId: s.parentId,
    startDate: projectStart,
    durationDays: s.durationDays,
    priority: s.priority,
    color: s.color,
    progress: s.progress,
    resourceIds: s.resourceIds,
    notes: s.notes ?? '',
    optimistic: s.optimistic ?? s.durationDays,
    mostLikely: s.durationDays,
    pessimistic: s.pessimistic ?? s.durationDays,
  }))

  const dep = (
    predecessorId: string,
    successorId: string,
    type: Dependency['type'] = 'FS',
    lagDays = 0,
  ): Dependency => ({
    id: `dep-${predecessorId}-${successorId}-${type}`,
    predecessorId,
    successorId,
    type,
    lagDays,
  })

  const dependencies: Dependency[] = [
    dep('t-1-1', 't-1-2', 'SS', 1),
    dep('t-1-1', 't-1-3'),
    dep('t-1-2', 't-1-3'),
    dep('t-1-3', 't-2-1'),
    dep('t-1-3', 't-2-3'),
    dep('t-1-3', 't-2-2'),
    dep('t-2-1', 't-3-1'),
    dep('t-2-1', 't-3-2'),
    dep('t-2-2', 't-3-3', 'SS', 2),
    dep('t-3-2', 't-3-4'),
    dep('t-3-3', 't-3-4'),
    dep('t-3-4', 't-4-1'),
    dep('t-4-1', 't-4-2'),
    dep('t-3-1', 't-4-1', 'SS', 20),
    dep('t-4-2', 't-5-1'),
    dep('t-4-2', 't-5-2', 'SS', 0),
  ]

  // Pin a couple of holidays shortly after the project start.
  const holidays = [addDays(projectStart, 17), addDays(projectStart, 18)]

  return {
    name: 'Proyek Pengembangan Aplikasi',
    tasks,
    dependencies,
    resources,
    calendar: {
      weekendDays: [0, 6],
      holidays,
      projectStart,
    },
  }
}
