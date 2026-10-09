import { useEffect, useMemo, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { Resource, Task } from '../types'
import type { ScheduleResult } from '../lib/schedule'
import type { Timeline } from '../lib/timeline'
import { diffDays } from '../lib/dateUtils'
import { keyboardStepDelta } from '../lib/dragUtils'
import { formatDate, initialsOf } from '../lib/format'
import { DAY_ROW_H, HEADER_H, MONTH_ROW_H, ROW_H } from './ganttLayout'

export interface ChartRow {
  task: Task
  depth: number
  childCount: number
}

export type DragMode = 'move' | 'resize'

export interface BarDragHandlers {
  onStart: (taskId: string, mode: DragMode) => void
  onUpdate: (taskId: string, mode: DragMode, deltaDays: number) => void
  onEnd: (taskId: string, mode: DragMode, deltaDays: number, moved: boolean) => void
}

interface BarBox {
  x: number
  w: number
  y: number
}

const DRAG_THRESHOLD_PX = 3

export function GanttChart({
  rows,
  schedule,
  timeline,
  showDeps,
  highlightCritical,
  selectedTaskId,
  draggingTaskId,
  resourceMap,
  drag,
  onSelect,
  onEdit,
}: {
  rows: ChartRow[]
  schedule: ScheduleResult
  timeline: Timeline
  showDeps: boolean
  highlightCritical: boolean
  selectedTaskId: string | null
  draggingTaskId: string | null
  resourceMap: Map<string, Resource>
  drag: BarDragHandlers
  onSelect: (id: string) => void
  onEdit: (id: string) => void
}) {
  const { dayWidth } = timeline

  const boxes = useMemo(() => {
    const map = new Map<string, BarBox>()
    rows.forEach((row, index) => {
      const entry = schedule.schedule[row.task.id]
      if (!entry) return
      const startIdx = Math.max(0, diffDays(timeline.start, entry.earlyStart))
      const span = diffDays(entry.earlyStart, entry.earlyFinish) + 1
      const x = startIdx * dayWidth
      const w = Math.max(dayWidth, span * dayWidth - 3)
      map.set(row.task.id, { x, w, y: index * ROW_H + ROW_H / 2 })
    })
    return map
  }, [rows, schedule, timeline.start, dayWidth])

  const arrows = useMemo(() => {
    if (!showDeps) return []
    const out: { id: string; path: string; critical: boolean; type: string }[] = []
    for (const dep of schedule.validDependencies) {
      const from = boxes.get(dep.predecessorId)
      const to = boxes.get(dep.successorId)
      if (!from || !to) continue
      const isFs = dep.type === 'FS'
      const sx = isFs ? from.x + from.w : from.x
      const sy = from.y
      const ex = to.x
      const ey = to.y
      let path: string
      if (ex - sx > 28) {
        path = `M ${sx} ${sy} L ${sx + 12} ${sy} L ${sx + 12} ${ey} L ${ex - 7} ${ey}`
      } else {
        const midY = sy + (ey - sy) / 2
        const outX = sx + 12
        const inX = ex - 14
        path = `M ${sx} ${sy} L ${outX} ${sy} L ${outX} ${midY} L ${inX} ${midY} L ${inX} ${ey} L ${ex - 7} ${ey}`
      }
      const critical =
        highlightCritical &&
        Boolean(schedule.schedule[dep.predecessorId]?.critical) &&
        Boolean(schedule.schedule[dep.successorId]?.critical)
      out.push({ id: dep.id, path, critical, type: dep.type })
    }
    return out
  }, [showDeps, schedule, boxes, highlightCritical])

  // --- drag handling -------------------------------------------------------
  const dragRef = useRef<{
    taskId: string
    mode: DragMode
    startX: number
    deltaDays: number
    moved: boolean
  } | null>(null)
  // Set while a drag runs so the following synthetic click does not re-select.
  const suppressClickRef = useRef(false)

  useEffect(() => {
    if (!draggingTaskId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dragRef.current = null
        suppressClickRef.current = true
        drag.onEnd(draggingTaskId, 'move', 0, false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draggingTaskId, drag])

  const beginDrag = (
    event: ReactPointerEvent<HTMLElement>,
    taskId: string,
    mode: DragMode,
  ) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const el = event.currentTarget
    el.setPointerCapture?.(event.pointerId)
    dragRef.current = { taskId, mode, startX: event.clientX, deltaDays: 0, moved: false }
    suppressClickRef.current = true
    drag.onStart(taskId, mode)
  }

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const state = dragRef.current
    if (!state) return
    const deltaPixels = event.clientX - state.startX
    if (Math.abs(deltaPixels) > DRAG_THRESHOLD_PX) state.moved = true
    const deltaDays = Math.round(deltaPixels / dayWidth)
    if (deltaDays !== state.deltaDays) {
      state.deltaDays = deltaDays
      drag.onUpdate(state.taskId, state.mode, deltaDays)
    }
  }

  const endDrag = () => {
    const state = dragRef.current
    dragRef.current = null
    if (!state) return
    drag.onEnd(state.taskId, state.mode, state.deltaDays, state.moved)
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  /**
   * Keyboard equivalent of a drag: Arrow keys nudge the start date, Alt+Arrow
   * resizes the duration. It funnels through the very same `onEnd` commit path
   * as a pointer drag, so both routes schedule identically.
   */
  const nudge = (
    event: ReactKeyboardEvent<HTMLElement>,
    taskId: string,
    isSummary: boolean,
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onEdit(taskId)
      return
    }
    if (event.key === ' ') {
      event.preventDefault()
      onSelect(taskId)
      return
    }
    if (isSummary) return
    const delta = keyboardStepDelta(event.key, event.shiftKey)
    if (delta === null) return
    event.preventDefault()
    drag.onEnd(taskId, event.altKey ? 'resize' : 'move', delta, true)
  }

  const draggedBox = draggingTaskId ? boxes.get(draggingTaskId) : undefined
  const draggedEntry = draggingTaskId ? schedule.schedule[draggingTaskId] : undefined
  const draggedTask = draggingTaskId
    ? rows.find((r) => r.task.id === draggingTaskId)?.task
    : undefined
  const pinned =
    Boolean(draggedTask && draggedEntry) &&
    draggedTask!.startDate !== draggedEntry!.earlyStart

  const bodyHeight = Math.max(rows.length * ROW_H, ROW_H)

  return (
    <div className="gantt-right" style={{ width: timeline.width }}>
      <div className="gantt-right-head" style={{ width: timeline.width, height: HEADER_H }}>
        <div className="month-row" style={{ height: MONTH_ROW_H }}>
          {timeline.months.map((m) => (
            <div
              key={m.key}
              className="month-cell"
              style={{ width: m.days * dayWidth }}
              title={m.label}
            >
              {m.days * dayWidth > 46 ? m.label : ''}
            </div>
          ))}
        </div>
        <div className="day-row" style={{ height: DAY_ROW_H }}>
          {timeline.days.map((d) => {
            const cls = [
              'day-cell',
              d.holiday ? 'holiday' : d.weekend ? 'nonwork' : '',
              d.today ? 'today' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <div key={d.iso} className={cls} style={{ width: dayWidth }} title={d.iso}>
                {dayWidth >= 16 ? <span className="dow">{d.dowLabel}</span> : null}
                <span>{d.dayNum}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="gantt-chart-body" style={{ width: timeline.width, height: bodyHeight }}>
        <div className="grid-layer">
          {timeline.days.map((d, i) =>
            d.holiday ? (
              <div
                key={d.iso}
                className="grid-holiday"
                style={{ left: i * dayWidth, width: dayWidth }}
              />
            ) : d.weekend ? (
              <div
                key={d.iso}
                className="grid-nonwork"
                style={{ left: i * dayWidth, width: dayWidth }}
              />
            ) : null,
          )}
          {timeline.days.some((d) => d.today) ? (
            <div
              className="grid-today"
              style={{ left: timeline.days.findIndex((d) => d.today) * dayWidth + dayWidth / 2 }}
            />
          ) : null}
        </div>

        {rows.map((row) => {
          const entry = schedule.schedule[row.task.id]
          const box = boxes.get(row.task.id)
          const isSummary = Boolean(entry?.isSummary)
          const critical = Boolean(entry?.critical) && highlightCritical
          const selected = row.task.id === selectedTaskId
          const isDragging = row.task.id === draggingTaskId
          const assigned = row.task.resourceIds
            .map((id) => resourceMap.get(id))
            .filter((r): r is Resource => Boolean(r))
          return (
            <div
              key={row.task.id}
              className={`chart-row${selected ? ' selected' : ''}`}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false
                  return
                }
                onSelect(row.task.id)
              }}
            >
              {box ? (
                <div
                  className={`bar${isSummary ? ' summary' : ''}${
                    critical ? ' critical' : ''
                  }${selected ? ' selected' : ''}${isDragging ? ' dragging' : ''}${
                    isSummary ? ' readonly' : ''
                  }`}
                  style={{
                    left: box.x,
                    width: box.w,
                    background: isSummary ? '#334155' : row.task.color,
                  }}
                  title={
                    isSummary
                      ? `${row.task.name}\nTugas ringkasan — tanggal mengikuti sub-tugas`
                      : `${row.task.name}\n${entry?.earlyStart} → ${entry?.earlyFinish} (${
                          entry?.durationDays
                        } hari kerja)\nTarik untuk menggeser, tarik sisi kanan untuk mengubah durasi. Panah kiri/kanan menggeser, Alt+panah mengubah durasi, Enter mengubah tugas.`
                  }
                  role={isSummary ? undefined : 'button'}
                  tabIndex={isSummary ? undefined : 0}
                  aria-label={
                    isSummary || !entry
                      ? undefined
                      : `${row.task.name}. ${formatDate(entry.earlyStart)} sampai ${formatDate(
                          entry.earlyFinish,
                        )}, ${entry.durationDays} hari kerja. Panah kiri atau kanan menggeser tanggal mulai, Alt plus panah mengubah durasi, Enter membuka editor.`
                  }
                  onKeyDown={(e) => nudge(e, row.task.id, isSummary)}
                  onPointerDown={(e) => {
                    if (isSummary) return
                    beginDrag(e, row.task.id, 'move')
                  }}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    onEdit(row.task.id)
                  }}
                >
                  {!isSummary ? (
                    <span
                      className="bar-progress"
                      style={{ width: `${Math.min(100, Math.max(0, row.task.progress))}%` }}
                    />
                  ) : null}
                  <span className="bar-label">{box.w > 54 ? row.task.name : ''}</span>
                  {!isSummary ? (
                    <span
                      className="bar-resize"
                      title="Tarik untuk mengubah durasi"
                      onPointerDown={(e) => beginDrag(e, row.task.id, 'resize')}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    />
                  ) : null}
                </div>
              ) : null}

              {box && !isSummary && assigned.length && dayWidth >= 16 ? (
                <div className="bar-avatars" style={{ left: box.x + box.w + 5 }}>
                  {assigned.slice(0, 2).map((r) => (
                    <span key={r.id} className="avatar" title={`${r.name} — ${r.role}`}>
                      {initialsOf(r.name)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}

        {showDeps ? (
          <svg className="dep-layer" width={timeline.width} height={bodyHeight} style={{ top: 0 }}>
            <defs>
              <marker
                id="dep-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
              </marker>
              <marker
                id="dep-arrow-critical"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
              </marker>
            </defs>
            {arrows.map((a) => (
              <path
                key={a.id}
                d={a.path}
                fill="none"
                stroke={a.critical ? '#ef4444' : '#94a3b8'}
                strokeWidth={a.critical ? 1.8 : 1.3}
                strokeDasharray={a.type === 'SS' ? '4 3' : undefined}
                markerEnd={`url(#${a.critical ? 'dep-arrow-critical' : 'dep-arrow'})`}
              />
            ))}
          </svg>
        ) : null}

        {draggedBox && draggedEntry ? (
          <div
            className="drag-tip"
            style={{ left: draggedBox.x + draggedBox.w / 2, top: draggedBox.y - ROW_H / 2 - 4 }}
          >
            {formatDate(draggedEntry.earlyStart)} → {formatDate(draggedEntry.earlyFinish)} ·{' '}
            {draggedEntry.durationDays} hari
            {pinned ? ' · dibatasi predecessor/tanggal mulai' : ''}
          </div>
        ) : null}
      </div>
    </div>
  )
}
