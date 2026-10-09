// Core domain model for the Gantt-based project management app.

export type Priority = 'low' | 'medium' | 'high' | 'critical'

export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical']

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
  critical: 'Kritis',
}

export type DependencyType = 'FS' | 'SS'

export const DEPENDENCY_LABELS: Record<DependencyType, string> = {
  FS: 'Finish to Start (FS)',
  SS: 'Start to Start (SS)',
}

export interface Task {
  id: string
  name: string
  parentId: string | null
  /** ISO date (yyyy-mm-dd) of the planned start. */
  startDate: string
  /** Duration expressed in working days (>= 1). */
  durationDays: number
  priority: Priority
  /** Hex color used for the Gantt bar / indicator. */
  color: string
  /** Completion percentage, 0..100. */
  progress: number
  resourceIds: string[]
  notes: string
  /** PERT three-point estimates in working days. */
  optimistic: number
  mostLikely: number
  pessimistic: number
}

export interface Dependency {
  id: string
  predecessorId: string
  successorId: string
  type: DependencyType
  /** Lag in working days, may be negative. */
  lagDays: number
}

export interface Resource {
  id: string
  name: string
  email: string
  role: string
  /** Monthly gross salary, in IDR. */
  salary: number
}

export interface ProjectCalendar {
  /** Days treated as weekend: 0 = Sunday ... 6 = Saturday. */
  weekendDays: number[]
  /** Custom holidays as ISO dates. */
  holidays: string[]
  /** Preferred first day of the project timeline. */
  projectStart: string
}

export interface ProjectData {
  name: string
  tasks: Task[]
  dependencies: Dependency[]
  resources: Resource[]
  calendar: ProjectCalendar
}

export const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
export const WEEKDAY_FULL = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
]
export const MONTH_LABELS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]
export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
]

export const EMPTY_TASK_COLOR = '#3b82f6'
