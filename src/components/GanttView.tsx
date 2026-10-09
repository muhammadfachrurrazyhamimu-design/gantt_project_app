import { useMemo, useState } from 'react'
import type { Task } from '../types'
import { useProjectStore, useResourceMap, useSchedule } from '../store/useProjectStore'
import { buildSchedule, flattenTasks } from '../lib/schedule'
import type { FlatTask } from '../lib/schedule'
import { buildTimeline, computeTimelineBounds } from '../lib/timeline'
import { addDays, minISO, startOfWeek, todayISO } from '../lib/dateUtils'
import { formatDate } from '../lib/format'
import { draggedDuration, draggedStartDate } from '../lib/dragUtils'
import { GanttChart } from './GanttChart'
import type { BarDragHandlers, ChartRow, DragMode } from './GanttChart'
import { TaskTable } from './TaskTable'
import { ConfirmDialog } from './ui'
import { TaskEditor } from './TaskEditor'
import { DAY_WIDTH_DEFAULT, DAY_WIDTH_MAX, DAY_WIDTH_MIN } from './ganttLayout'

function buildWbs(flat: FlatTask[]): Map<string, string> {
  const map = new Map<string, string>()
  const counters: number[] = []
  for (const { task, depth } of flat) {
    counters.length = depth + 1
    counters[depth] = (counters[depth] ?? 0) + 1
    map.set(task.id, counters.slice(0, depth + 1).join('.'))
  }
  return map
}

interface DragState {
  taskId: string
  mode: DragMode
  deltaDays: number
}

export function GanttView() {
  const tasks = useProjectStore((s) => s.tasks)
  const dependencies = useProjectStore((s) => s.dependencies)
  const calendar = useProjectStore((s) => s.calendar)
  const selectedTaskId = useProjectStore((s) => s.selectedTaskId)
  const selectTask = useProjectStore((s) => s.selectTask)
  const deleteTask = useProjectStore((s) => s.deleteTask)
  const updateTask = useProjectStore((s) => s.updateTask)

  const schedule = useSchedule()
  const resourceMap = useResourceMap()

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [dayWidth, setDayWidth] = useState(DAY_WIDTH_DEFAULT)
  const [showDeps, setShowDeps] = useState(true)
  const [highlightCritical, setHighlightCritical] = useState(true)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  // Announced to screen readers (and reused as the visible hint text) after any
  // keyboard or pointer edit, so the resulting schedule change is perceivable.
  const [announce, setAnnounce] = useState('')
  const [editor, setEditor] = useState<{
    taskId: string | null
    parentId: string | null
  } | null>(null)

  const workCal = useMemo(
    () => ({ weekendDays: calendar.weekendDays, holidays: calendar.holidays }),
    [calendar],
  )

  // --- Live drag preview ---------------------------------------------------
  // While dragging we re-run the CPM engine on a tentative copy so the preview
  // honestly reflects dependency constraints instead of just moving the bar.
  const previewTasks = useMemo(() => {
    if (!drag) return tasks
    const base = tasks.find((t) => t.id === drag.taskId)
    if (!base) return tasks
    if (drag.mode === 'move') {
      return tasks.map((t) =>
        t.id === drag.taskId
          ? { ...t, startDate: draggedStartDate(base.startDate, drag.deltaDays) }
          : t,
      )
    }
    const committed = schedule.schedule[drag.taskId]
    if (!committed) return tasks
    const durationDays = draggedDuration(
      committed.earlyStart,
      committed.earlyFinish,
      drag.deltaDays,
      workCal,
    )
    return tasks.map((t) => (t.id === drag.taskId ? { ...t, durationDays } : t))
  }, [drag, tasks, schedule, workCal])

  const viewSchedule = useMemo(
    () =>
      drag ? buildSchedule(previewTasks, dependencies, calendar) : schedule,
    [drag, previewTasks, dependencies, calendar, schedule],
  )

  const dragHandlers: BarDragHandlers = useMemo(
    () => ({
      onStart: (taskId, mode) => setDrag({ taskId, mode, deltaDays: 0 }),
      onUpdate: (taskId, mode, deltaDays) => setDrag({ taskId, mode, deltaDays }),
      onEnd: (taskId, mode, deltaDays, moved) => {
        setDrag(null)
        if (!moved || deltaDays === 0) return
        const task = tasks.find((t) => t.id === taskId)
        if (!task) return
        if (mode === 'move') {
          const startDate = draggedStartDate(task.startDate, deltaDays)
          updateTask(taskId, { startDate })
          setAnnounce(
            `${task.name}: tanggal mulai ${formatDate(task.startDate)} → ${formatDate(
              startDate,
            )}`,
          )
          return
        }
        const committed = schedule.schedule[taskId]
        if (!committed) return
        const durationDays = draggedDuration(
          committed.earlyStart,
          committed.earlyFinish,
          deltaDays,
          workCal,
        )
        updateTask(taskId, { durationDays })
        setAnnounce(`${task.name}: durasi ${committed.durationDays} → ${durationDays} hari kerja`)
      },
    }),
    [tasks, schedule, updateTask, workCal],
  )

  const flat = useMemo(() => flattenTasks(tasks), [tasks])
  const wbs = useMemo(() => buildWbs(flat), [flat])

  const parentOf = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const t of tasks) map.set(t.id, t.parentId)
    return map
  }, [tasks])

  const rows: ChartRow[] = useMemo(() => {
    return flat
      .filter(({ task }) => {
        let parent = parentOf.get(task.id) ?? null
        while (parent) {
          if (collapsed.has(parent)) return false
          parent = parentOf.get(parent) ?? null
        }
        return true
      })
      .map(({ task, depth, childCount }) => ({ task, depth, childCount }))
  }, [flat, collapsed, parentOf])

  const timeline = useMemo(() => {
    const starts: string[] = []
    const finishes: string[] = []
    for (const task of tasks) {
      const entry = schedule.schedule[task.id]
      if (!entry) continue
      starts.push(entry.earlyStart)
      finishes.push(entry.earlyFinish)
    }
    const bounds = computeTimelineBounds(
      starts,
      finishes,
      calendar.projectStart,
      schedule.projectFinish,
    )
    const start = startOfWeek(minISO(bounds.start, calendar.projectStart), 1)
    let end = addDays(startOfWeek(bounds.end, 1), 6)
    if (end < start) end = addDays(start, 13)
    return buildTimeline(start, end, workCal, dayWidth, todayISO())
  }, [tasks, schedule, calendar, dayWidth, workCal])

  const selected = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null
  const selectedEntry = selected ? viewSchedule.schedule[selected.id] : undefined

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const zoom = (delta: number) =>
    setDayWidth((w) => Math.min(DAY_WIDTH_MAX, Math.max(DAY_WIDTH_MIN, w + delta)))

  return (
    <div className="view">
      <div className="panel gantt-layout">
        <div className="gantt-toolbar">
          <button
            className="btn primary"
            onClick={() => setEditor({ taskId: null, parentId: null })}
          >
            ＋ Tugas Baru
          </button>
          <button
            className="btn"
            onClick={() => setEditor({ taskId: null, parentId: selectedTaskId })}
            disabled={!selectedTaskId}
            title="Tambah sub-tugas di bawah tugas terpilih"
          >
            ＋ Sub-tugas
          </button>

          <span style={{ width: 1, height: 24, background: 'var(--border)' }} />

          <div className="row" style={{ gap: 4 }}>
            <button className="btn tiny" onClick={() => zoom(-4)} title="Perkecil skala">
              −
            </button>
            <span className="tag mono" style={{ width: 54, textAlign: 'center' }}>
              {dayWidth}px/hari
            </span>
            <button className="btn tiny" onClick={() => zoom(4)} title="Perbesar skala">
              ＋
            </button>
          </div>

          <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showDeps}
              style={{ width: 'auto' }}
              onChange={(e) => setShowDeps(e.target.checked)}
            />
            <span className="tag">Predecessor</span>
          </label>

          <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={highlightCritical}
              style={{ width: 'auto' }}
              onChange={(e) => setHighlightCritical(e.target.checked)}
            />
            <span className="tag">Jalur kritis</span>
          </label>

          <div style={{ flex: 1 }} />

          <div className="legend">
            <span className="item">
              <span className="dot" style={{ background: '#fff', border: '2px solid #ef4444' }} />
              Kritis
            </span>
            <span className="item">
              <span className="dot" style={{ background: '#334155' }} />
              Ringkasan
            </span>
            <span className="item">
              <svg width="26" height="8">
                <line x1="0" y1="4" x2="26" y2="4" stroke="#94a3b8" strokeWidth="1.6" />
              </svg>
              FS
            </span>
            <span className="item">
              <svg width="26" height="8">
                <line
                  x1="0"
                  y1="4"
                  x2="26"
                  y2="4"
                  stroke="#94a3b8"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
              </svg>
              SS
            </span>
          </div>
        </div>

        <div className="gantt-hint">
          Tarik batang untuk menggeser tanggal mulai · tarik sisi kanan batang untuk mengubah
          durasi · <kbd>Esc</kbd> untuk membatalkan · lewat keyboard: fokuskan batang lalu{' '}
          <kbd>←</kbd>/<kbd>→</kbd> menggeser, <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> mengubah
          durasi, <kbd>Shift</kbd> untuk langkah 5 hari, <kbd>Enter</kbd> membuka editor
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>

        {schedule.warnings.length ? (
          <div className="alert" style={{ margin: '10px 14px 0' }}>
            {schedule.warnings.join(' ')}
          </div>
        ) : null}

        <div className="gantt-scroll">
          {tasks.length === 0 ? (
            <div className="empty">
              Belum ada tugas. Klik <strong>Tugas Baru</strong> untuk memulai.
            </div>
          ) : (
            <div className="gantt-inner">
              <TaskTable
                rows={rows}
                wbs={wbs}
                schedule={viewSchedule}
                resourceMap={resourceMap}
                selectedTaskId={selectedTaskId}
                collapsed={collapsed}
                onToggleCollapse={toggleCollapse}
                onSelect={(id) => selectTask(id)}
                onEdit={(id) => setEditor({ taskId: id, parentId: null })}
                onAddSubtask={(id) => setEditor({ taskId: null, parentId: id })}
                onDelete={(id) => setPendingDelete(tasks.find((t) => t.id === id) ?? null)}
              />
              <GanttChart
                rows={rows}
                schedule={viewSchedule}
                timeline={timeline}
                showDeps={showDeps}
                highlightCritical={highlightCritical}
                selectedTaskId={selectedTaskId}
                draggingTaskId={drag?.taskId ?? null}
                resourceMap={resourceMap}
                drag={dragHandlers}
                onSelect={(id) => selectTask(id)}
                onEdit={(id) => setEditor({ taskId: id, parentId: null })}
              />
            </div>
          )}
        </div>

        {selected && selectedEntry ? (
          <div
            className="row wrap"
            style={{
              gap: 14,
              padding: '9px 14px',
              borderTop: '1px solid var(--border)',
              background: 'var(--panel-alt)',
              fontSize: 12.5,
            }}
          >
            <span className="row" style={{ gap: 6 }}>
              <span className="swatch" style={{ background: selected.color }} />
              <strong>{selected.name}</strong>
            </span>
            <span className="tag">
              {formatDate(selectedEntry.earlyStart)} → {formatDate(selectedEntry.earlyFinish)}
            </span>
            <span className="tag">{selectedEntry.durationDays} hari kerja</span>
            <span className="tag">
              Slack: {selectedEntry.slackDays} hari {selectedEntry.critical ? '· kritis' : ''}
            </span>
            <span className="tag">
              {selected.resourceIds.length} anggota · progres {selected.progress}%
            </span>
            <button
              className="btn tiny"
              style={{ marginLeft: 'auto' }}
              onClick={() => setEditor({ taskId: selected.id, parentId: null })}
            >
              Ubah
            </button>
            <button
              className="btn tiny"
              onClick={() =>
                updateTask(selected.id, { progress: Math.min(100, selected.progress + 10) })
              }
              title="Tandai progres +10%"
            >
              +10% progres
            </button>
          </div>
        ) : null}
      </div>

      {editor ? (
        <TaskEditor
          taskId={editor.taskId}
          defaultParentId={editor.parentId}
          defaultStartDate={
            editor.parentId
              ? tasks.find((t) => t.id === editor.parentId)?.startDate ?? calendar.projectStart
              : calendar.projectStart
          }
          onClose={() => setEditor(null)}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Hapus tugas"
          message={`Hapus "${pendingDelete.name}" beserta seluruh sub-tugas dan hubungan predecessornya?`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteTask(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      ) : null}
    </div>
  )
}
