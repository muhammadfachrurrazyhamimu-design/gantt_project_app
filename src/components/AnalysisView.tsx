import { useMemo } from 'react'
import { useProjectStore, useSchedule } from '../store/useProjectStore'
import { buildPert } from '../lib/pert'
import { countWorkingDays } from '../lib/calendar'
import { summaryTaskIds } from '../lib/schedule'
import { formatDate, formatNumber } from '../lib/format'
import { PertDiagram } from './PertDiagram'

export function AnalysisView() {
  const tasks = useProjectStore((s) => s.tasks)
  const dependencies = useProjectStore((s) => s.dependencies)
  const calendar = useProjectStore((s) => s.calendar)
  const selectTask = useProjectStore((s) => s.selectTask)
  const schedule = useSchedule()

  const pert = useMemo(() => buildPert(tasks, dependencies, calendar), [
    tasks,
    dependencies,
    calendar,
  ])

  const cal = { weekendDays: calendar.weekendDays, holidays: calendar.holidays }
  const deterministicDays = countWorkingDays(
    schedule.projectStart,
    schedule.projectFinish,
    cal,
  )

  const summaryIds = useMemo(() => summaryTaskIds(tasks), [tasks])
  const leaves = useMemo(
    () =>
      tasks
        .filter((t) => !summaryIds.has(t.id))
        .sort((a, b) => {
          const sa = schedule.schedule[a.id]?.earlyStart ?? ''
          const sb = schedule.schedule[b.id]?.earlyStart ?? ''
          return sa < sb ? -1 : sa > sb ? 1 : 0
        }),
    [tasks, summaryIds, schedule],
  )

  const nameOf = (id: string) => tasks.find((t) => t.id === id)?.name ?? id
  const criticalChain = schedule.criticalPath.length
    ? schedule.criticalPath
    : schedule.criticalIds

  const onTime = pert.onTimeProbability * 100

  return (
    <div className="view scroll">
      <div className="stat-grid">
        <div className="stat">
          <div className="label">Durasi proyek</div>
          <div className="value">{deterministicDays} hari kerja</div>
          <div className="sub">
            {formatDate(schedule.projectStart)} → {formatDate(schedule.projectFinish)}
          </div>
        </div>
        <div className="stat">
          <div className="label">Durasi PERT (te)</div>
          <div className="value">{formatNumber(pert.expectedDuration, 1)} hari</div>
          <div className="sub">Jumlah te sepanjang jalur kritis</div>
        </div>
        <div className="stat">
          <div className="label">Deviasi standar</div>
          <div className="value">± {formatNumber(pert.stdDev, 2)} hari</div>
          <div className="sub">√Σ varians jalur kritis</div>
        </div>
        <div className="stat">
          <div className="label">Peluang selesai tepat waktu</div>
          <div className="value">{formatNumber(onTime, 1)}%</div>
          <div className="sub">P(T ≤ durasi deterministik)</div>
        </div>
        <div className="stat">
          <div className="label">Tugas kritis</div>
          <div className="value">
            {schedule.criticalIds.length} / {leaves.length}
          </div>
          <div className="sub">Slack = 0 hari</div>
        </div>
        <div className="stat">
          <div className="label">Panjang jalur kritis</div>
          <div className="value">{criticalChain.length} tugas</div>
          <div className="sub">Rangkaian ketergantungan terpanjang</div>
        </div>
      </div>

      {schedule.warnings.length ? (
        <div className="alert">{schedule.warnings.join(' ')}</div>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <h2>Jalur Kritis (Critical Path)</h2>
          <span className="hint">Total float = 0 hari</span>
        </div>
        <div className="panel-body">
          {criticalChain.length === 0 ? (
            <div className="empty">Belum ada tugas untuk dianalisis.</div>
          ) : (
            <div className="row wrap" style={{ gap: 6 }}>
              {criticalChain.map((id, i) => (
                <span key={id} className="row" style={{ gap: 6 }}>
                  {i > 0 ? <span className="muted">→</span> : null}
                  <span
                    className="badge cp"
                    style={{ cursor: 'pointer' }}
                    onClick={() => selectTask(id)}
                    title="Klik untuk memilih tugas"
                  >
                    {nameOf(id)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Analisis CPM (Critical Path Method)</h2>
          <span className="hint">
            ES/EF = paling awal · LS/LF = paling lambat · semua dalam hari kerja
          </span>
        </div>
        <div className="table-scroll" style={{ maxHeight: 420 }}>
          <table className="table">
            <thead>
              <tr>
                <th>No</th>
                <th>Tugas</th>
                <th className="num">Durasi</th>
                <th>Mulai awal (ES)</th>
                <th>Selesai awal (EF)</th>
                <th>Mulai lambat (LS)</th>
                <th>Selesai lambat (LF)</th>
                <th className="num">Slack</th>
                <th className="center">Status</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((task, index) => {
                const e = schedule.schedule[task.id]
                if (!e) return null
                return (
                  <tr key={task.id}>
                    <td className="mono muted">{index + 1}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="swatch" style={{ background: task.color }} />
                        <span
                          className="link"
                          onClick={() => selectTask(task.id)}
                        >
                          {task.name}
                        </span>
                      </div>
                    </td>
                    <td className="num mono">{e.durationDays}</td>
                    <td className="mono">{e.earlyStart}</td>
                    <td className="mono">{e.earlyFinish}</td>
                    <td className="mono">{e.lateStart}</td>
                    <td className="mono">{e.lateFinish}</td>
                    <td className="num mono">{e.slackDays}</td>
                    <td className="center">
                      {e.critical ? (
                        <span className="badge cp">Kritis</span>
                      ) : (
                        <span className="badge ok">Aman</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Diagram PERT</h2>
          <span className="hint">
            Activity-on-node · te = (O + 4M + P) / 6 · garis merah = jalur kritis
          </span>
        </div>
        <div className="panel-body">
          {leaves.length === 0 ? (
            <div className="empty">Belum ada tugas untuk dibuat diagram.</div>
          ) : (
            <PertDiagram
              tasks={leaves}
              dependencies={dependencies}
              schedule={pert.schedule}
              estimates={pert.estimates}
            />
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Estimasi Tiga Titik (PERT)</h2>
          <span className="hint">O = optimis, M = paling mungkin, P = pesimis</span>
        </div>
        <div className="table-scroll" style={{ maxHeight: 420 }}>
          <table className="table">
            <thead>
              <tr>
                <th>No</th>
                <th>Tugas</th>
                <th className="num">O</th>
                <th className="num">M</th>
                <th className="num">P</th>
                <th className="num">te</th>
                <th className="num">Varians (σ²)</th>
                <th className="num">σ</th>
                <th className="num">Rentang ± σ</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((task, index) => {
                const est = pert.estimates[task.id]
                if (!est) return null
                return (
                  <tr key={task.id}>
                    <td className="mono muted">{index + 1}</td>
                    <td>{task.name}</td>
                    <td className="num mono">{est.optimistic}</td>
                    <td className="num mono">{est.mostLikely}</td>
                    <td className="num mono">{est.pessimistic}</td>
                    <td className="num mono" style={{ fontWeight: 650 }}>
                      {formatNumber(est.expected, 2)}
                    </td>
                    <td className="num mono">{formatNumber(est.variance, 3)}</td>
                    <td className="num mono">{formatNumber(est.stdDev, 3)}</td>
                    <td className="num mono">
                      {formatNumber(Math.max(1, est.expected - est.stdDev), 1)} –{' '}
                      {formatNumber(est.expected + est.stdDev, 1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="num" style={{ fontWeight: 650 }}>
                  Total jalur kritis
                </td>
                <td className="num mono" style={{ fontWeight: 700 }}>
                  {formatNumber(pert.expectedDuration, 2)}
                </td>
                <td className="num mono" style={{ fontWeight: 700 }}>
                  {formatNumber(pert.variance, 3)}
                </td>
                <td className="num mono" style={{ fontWeight: 700 }}>
                  {formatNumber(pert.stdDev, 3)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
