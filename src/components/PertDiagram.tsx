import { useMemo } from 'react'
import type { Dependency, Task } from '../types'
import type { ScheduleResult } from '../lib/schedule'
import type { PertEstimate } from '../lib/pert'

const BOX_W = 172
const BOX_H = 74
const GAP_X = 66
const GAP_Y = 22
const PAD = 28

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function PertDiagram({
  tasks,
  dependencies,
  schedule,
  estimates,
}: {
  tasks: Task[]
  dependencies: Dependency[]
  schedule: ScheduleResult
  estimates: Record<string, PertEstimate>
}) {
  const layout = useMemo(() => {
    const ids = new Set(tasks.map((t) => t.id))
    const deps = dependencies.filter(
      (d) => ids.has(d.predecessorId) && ids.has(d.successorId),
    )
    const incoming = new Map<string, Dependency[]>()
    for (const id of ids) incoming.set(id, [])
    for (const d of deps) incoming.get(d.successorId)?.push(d)

    const order = schedule.order.filter((id) => ids.has(id))
    const remaining = tasks.map((t) => t.id).filter((id) => !order.includes(id))
    const topo = [...order, ...remaining]

    const level = new Map<string, number>()
    for (const id of topo) {
      let l = 0
      for (const d of incoming.get(id) ?? []) {
        l = Math.max(l, (level.get(d.predecessorId) ?? 0) + 1)
      }
      level.set(id, l)
    }

    const columns = new Map<number, string[]>()
    for (const id of topo) {
      const l = level.get(id) ?? 0
      const list = columns.get(l) ?? []
      list.push(id)
      columns.set(l, list)
    }
    // Order each column by early start so arrows read top-to-bottom.
    for (const [, list] of columns) {
      list.sort((a, b) => {
        const sa = schedule.schedule[a]?.earlyStart ?? ''
        const sb = schedule.schedule[b]?.earlyStart ?? ''
        return sa < sb ? -1 : sa > sb ? 1 : 0
      })
    }

    const levelKeys = [...columns.keys()].sort((a, b) => a - b)
    let maxCount = 1
    for (const [, list] of columns) maxCount = Math.max(maxCount, list.length)

    const columnHeight = (count: number) => count * BOX_H + (count - 1) * GAP_Y
    const totalHeight = PAD * 2 + columnHeight(maxCount)
    const totalWidth = PAD * 2 + levelKeys.length * BOX_W + Math.max(0, levelKeys.length - 1) * GAP_X

    const pos = new Map<string, { x: number; y: number }>()
    levelKeys.forEach((l, colIndex) => {
      const list = columns.get(l) ?? []
      const height = columnHeight(list.length)
      const offset = PAD + (columnHeight(maxCount) - height) / 2
      list.forEach((id, rowIndex) => {
        pos.set(id, {
          x: PAD + colIndex * (BOX_W + GAP_X),
          y: offset + rowIndex * (BOX_H + GAP_Y),
        })
      })
    })

    const edges = deps
      .map((d) => {
        const from = pos.get(d.predecessorId)
        const to = pos.get(d.successorId)
        if (!from || !to) return null
        const x1 = from.x + BOX_W
        const y1 = from.y + BOX_H / 2
        const x2 = to.x
        const y2 = to.y + BOX_H / 2
        const midX = x1 + GAP_X / 2
        return {
          id: d.id,
          type: d.type,
          path: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2 - 6}`,
          critical:
            Boolean(schedule.schedule[d.predecessorId]?.critical) &&
            Boolean(schedule.schedule[d.successorId]?.critical),
        }
      })
      .filter((e): e is NonNullable<typeof e> => Boolean(e))

    return { pos, edges, totalWidth, totalHeight }
  }, [tasks, dependencies, schedule])

  return (
    <div className="pert-svg">
      <svg width={layout.totalWidth} height={layout.totalHeight}>
        <defs>
          <marker
            id="pert-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
          <marker
            id="pert-arrow-critical"
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

        {layout.edges.map((e) => (
          <path
            key={e.id}
            d={e.path}
            fill="none"
            stroke={e.critical ? '#ef4444' : '#94a3b8'}
            strokeWidth={e.critical ? 1.8 : 1.3}
            strokeDasharray={e.type === 'SS' ? '5 3' : undefined}
            markerEnd={`url(#${e.critical ? 'pert-arrow-critical' : 'pert-arrow'})`}
          />
        ))}

        {tasks.map((task) => {
          const p = layout.pos.get(task.id)
          if (!p) return null
          const entry = schedule.schedule[task.id]
          const est = estimates[task.id]
          const critical = Boolean(entry?.critical)
          return (
            <g key={task.id} className="pert-node">
              <rect
                x={p.x}
                y={p.y}
                width={BOX_W}
                height={BOX_H}
                rx={9}
                fill={critical ? '#fef2f2' : '#ffffff'}
                stroke={critical ? '#ef4444' : '#cbd5e1'}
                strokeWidth={critical ? 2 : 1}
              />
              <rect x={p.x} y={p.y} width={4} height={BOX_H} rx={2} fill={task.color} />
              <text x={p.x + 12} y={p.y + 20} fontSize={11.5} fontWeight={700} fill="#0f172a">
                {truncate(task.name, 24)}
              </text>
              <text x={p.x + 12} y={p.y + 38} fontSize={10.5} fill="#475569">
                te {est ? est.expected.toFixed(1) : task.durationDays} hr · σ²{' '}
                {est ? est.variance.toFixed(2) : '0.00'}
              </text>
              <text x={p.x + 12} y={p.y + 54} fontSize={10.5} fill="#64748b">
                {entry ? `${entry.earlyStart} → ${entry.earlyFinish}` : '—'}
              </text>
              <text x={p.x + 12} y={p.y + 68} fontSize={10.5} fontWeight={600} fill={critical ? '#b91c1c' : '#334155'}>
                slack {entry?.slackDays ?? 0} hr{critical ? ' · KRITIS' : ''}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
