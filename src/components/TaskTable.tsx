import type { Resource } from '../types'
import type { ScheduleResult } from '../lib/schedule'
import { formatDateShort } from '../lib/format'
import { GRID_TEMPLATE, HEADER_H, LEFT_WIDTH, ROW_H } from './ganttLayout'
import { AvatarGroup, PriorityBadge, ProgressBar } from './ui'
import type { ChartRow } from './GanttChart'

export function TaskTable({
  rows,
  wbs,
  schedule,
  resourceMap,
  selectedTaskId,
  collapsed,
  onToggleCollapse,
  onSelect,
  onEdit,
  onAddSubtask,
  onDelete,
}: {
  rows: ChartRow[]
  wbs: Map<string, string>
  schedule: ScheduleResult
  resourceMap: Map<string, Resource>
  selectedTaskId: string | null
  collapsed: Set<string>
  onToggleCollapse: (id: string) => void
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onAddSubtask: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="gantt-left" style={{ width: LEFT_WIDTH }}>
      <div
        className="gantt-left-head"
        style={{ gridTemplateColumns: GRID_TEMPLATE, height: HEADER_H }}
      >
        <div className="gantt-head-cell center">#</div>
        <div className="gantt-head-cell">Tugas</div>
        <div className="gantt-head-cell">Mulai</div>
        <div className="gantt-head-cell">Selesai</div>
        <div className="gantt-head-cell center">Durasi</div>
        <div className="gantt-head-cell">Prioritas</div>
        <div className="gantt-head-cell">Tim</div>
        <div className="gantt-head-cell center">Progres</div>
        <div className="gantt-head-cell center">Aksi</div>
      </div>

      {rows.map(({ task, depth, childCount }) => {
        const entry = schedule.schedule[task.id]
        const resources = task.resourceIds
          .map((id) => resourceMap.get(id))
          .filter((r): r is Resource => Boolean(r))
        const summary = Boolean(entry?.isSummary)
        const critical = Boolean(entry?.critical)
        const isCollapsed = collapsed.has(task.id)
        const indent = 8 + depth * 14
        return (
          <div
            key={task.id}
            className={`gantt-row${task.id === selectedTaskId ? ' selected' : ''}`}
            style={{ gridTemplateColumns: GRID_TEMPLATE, height: ROW_H }}
            onClick={() => onSelect(task.id)}
            onDoubleClick={() => onEdit(task.id)}
          >
            <div className="gantt-cell center mono" style={{ fontSize: 11, color: '#94a3b8' }}>
              {wbs.get(task.id) ?? ''}
            </div>

            <div className="gantt-cell" style={{ paddingLeft: indent }}>
              {childCount > 0 ? (
                <button
                  className="subtask-toggle"
                  title={isCollapsed ? 'Buka sub-tugas' : 'Tutup sub-tugas'}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleCollapse(task.id)
                  }}
                >
                  {isCollapsed ? '＋' : '−'}
                </button>
              ) : (
                <span style={{ width: 16, flex: 'none' }} />
              )}
              <span className="swatch" style={{ background: task.color }} />
              <span
                className={`task-name${summary ? ' summary' : ''}`}
                title={task.name}
              >
                {task.name}
              </span>
              {critical ? (
                <span className="badge cp" style={{ padding: '0 5px' }} title="Jalur kritis">
                  CP
                </span>
              ) : null}
            </div>

            <div className="gantt-cell mono" style={{ fontSize: 11.5 }}>
              {entry ? formatDateShort(entry.earlyStart) : '—'}
            </div>
            <div className="gantt-cell mono" style={{ fontSize: 11.5 }}>
              {entry ? formatDateShort(entry.earlyFinish) : '—'}
            </div>
            <div className="gantt-cell center mono">
              {summary ? `${task.durationDays}*` : task.durationDays}
            </div>
            <div className="gantt-cell">
              <PriorityBadge priority={task.priority} />
            </div>
            <div className="gantt-cell">
              <AvatarGroup resources={resources} />
            </div>
            <div className="gantt-cell center">
              <ProgressBar value={task.progress} />
            </div>
            <div className="gantt-cell" style={{ justifyContent: 'flex-end' }}>
              <div className="row-actions">
                <button
                  className="icon-btn"
                  title="Tambah sub-tugas"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddSubtask(task.id)
                  }}
                >
                  ＋
                </button>
                <button
                  className="icon-btn"
                  title="Ubah tugas"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(task.id)
                  }}
                >
                  ✎
                </button>
                <button
                  className="icon-btn danger"
                  title="Hapus tugas"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(task.id)
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
