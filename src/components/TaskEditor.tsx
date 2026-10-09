import { useMemo, useState } from 'react'
import type { DependencyType, Priority, Task } from '../types'
import { DEPENDENCY_LABELS, PRIORITIES, PRIORITY_LABELS } from '../types'
import { useProjectStore, useSchedule } from '../store/useProjectStore'
import { flattenTasks } from '../lib/schedule'
import { taskFinish } from '../lib/calendar'
import { formatDate } from '../lib/format'
import { Modal } from './ui'

interface FormState {
  name: string
  parentId: string
  startDate: string
  durationDays: string
  priority: Priority
  color: string
  progress: number
  resourceIds: string[]
  notes: string
  optimistic: string
  mostLikely: string
  pessimistic: string
}

function toForm(task: Task | null, defaults: { parentId: string | null; startDate: string }): FormState {
  return {
    name: task?.name ?? '',
    parentId: task?.parentId ?? defaults.parentId ?? '',
    startDate: task?.startDate ?? defaults.startDate,
    durationDays: String(task?.durationDays ?? 3),
    priority: task?.priority ?? 'medium',
    color: task?.color ?? '#3b82f6',
    progress: task?.progress ?? 0,
    resourceIds: task?.resourceIds ?? [],
    notes: task?.notes ?? '',
    optimistic: String(task?.optimistic ?? task?.durationDays ?? 3),
    mostLikely: String(task?.mostLikely ?? task?.durationDays ?? 3),
    pessimistic: String(task?.pessimistic ?? task?.durationDays ?? 3),
  }
}

export function TaskEditor({
  taskId,
  defaultParentId = null,
  defaultStartDate,
  onClose,
}: {
  taskId?: string | null
  defaultParentId?: string | null
  defaultStartDate: string
  onClose: () => void
}) {
  const tasks = useProjectStore((s) => s.tasks)
  const resources = useProjectStore((s) => s.resources)
  const dependencies = useProjectStore((s) => s.dependencies)
  const calendar = useProjectStore((s) => s.calendar)
  const addTask = useProjectStore((s) => s.addTask)
  const updateTask = useProjectStore((s) => s.updateTask)
  const deleteTask = useProjectStore((s) => s.deleteTask)
  const addDependency = useProjectStore((s) => s.addDependency)
  const updateDependency = useProjectStore((s) => s.updateDependency)
  const deleteDependency = useProjectStore((s) => s.deleteDependency)
  const schedule = useSchedule()

  const existing = taskId ? tasks.find((t) => t.id === taskId) ?? null : null
  const [form, setForm] = useState<FormState>(() =>
    toForm(existing, { parentId: defaultParentId, startDate: defaultStartDate }),
  )
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // Candidate parents: never allow a task to be its own ancestor (cycle).
  const parentOptions = useMemo(() => {
    const flat = flattenTasks(tasks)
    if (!existing) return flat
    const banned = new Set<string>([existing.id])
    let grew = true
    while (grew) {
      grew = false
      for (const t of tasks) {
        if (t.parentId && banned.has(t.parentId) && !banned.has(t.id)) {
          banned.add(t.id)
          grew = true
        }
      }
    }
    return flat.filter((f) => !banned.has(f.task.id))
  }, [tasks, existing])

  const childrenOfExisting = existing
    ? tasks.some((t) => t.parentId === existing.id)
    : false

  // Predecessor options: leaf tasks only (summaries have no own schedule).
  const leafOptions = useMemo(() => {
    const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean) as string[])
    return tasks.filter((t) => !parentIds.has(t.id))
  }, [tasks])

  const incoming = existing
    ? dependencies.filter((d) => d.successorId === existing.id)
    : []

  const finishPreview = useMemo(() => {
    const duration = Math.max(1, Math.round(Number(form.durationDays) || 1))
    return taskFinish(form.startDate, duration, calendar)
  }, [form.startDate, form.durationDays, calendar])

  const scheduleEntry = existing ? schedule.schedule[existing.id] : undefined

  const submit = () => {
    const name = form.name.trim()
    if (!name) {
      setError('Nama tugas wajib diisi.')
      return
    }
    const duration = Math.max(1, Math.round(Number(form.durationDays)))
    if (!Number.isFinite(duration) || duration < 1) {
      setError('Durasi minimal 1 hari kerja.')
      return
    }
    const patch: Partial<Task> = {
      name,
      parentId: form.parentId || null,
      startDate: form.startDate,
      durationDays: duration,
      priority: form.priority,
      color: form.color,
      progress: Math.min(100, Math.max(0, Math.round(form.progress))),
      resourceIds: form.resourceIds,
      notes: form.notes,
      optimistic: Math.max(1, Math.round(Number(form.optimistic) || duration)),
      mostLikely: Math.max(1, Math.round(Number(form.mostLikely) || duration)),
      pessimistic: Math.max(1, Math.round(Number(form.pessimistic) || duration)),
    }
    if (existing) {
      updateTask(existing.id, patch)
    } else {
      addTask(patch)
    }
    onClose()
  }

  return (
    <Modal
      title={existing ? 'Ubah Tugas' : 'Tugas Baru'}
      subtitle={
        existing
          ? scheduleEntry
            ? `Jadwal terhitung: ${formatDate(scheduleEntry.earlyStart)} → ${formatDate(scheduleEntry.earlyFinish)}`
            : undefined
          : 'Isi detail tugas lalu simpan'
      }
      maxWidth={780}
      onClose={onClose}
      footer={
        <>
          {existing ? (
            <button
              className="btn danger"
              style={{ marginRight: 'auto' }}
              onClick={() => {
                deleteTask(existing.id)
                onClose()
              }}
            >
              Hapus Tugas
            </button>
          ) : null}
          <button className="btn" onClick={onClose}>
            Batal
          </button>
          <button className="btn primary" onClick={submit}>
            Simpan
          </button>
        </>
      }
    >
      <div className="stack">
        {error ? <div className="alert">{error}</div> : null}

        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="task-name">Nama tugas</label>
            <input
              id="task-name"
              type="text"
              value={form.name}
              placeholder="Contoh: Analisis kebutuhan"
              onChange={(e) => set('name', e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="task-parent">Tugas induk (sub-tugas dari)</label>
            <select
              id="task-parent"
              value={form.parentId}
              onChange={(e) => set('parentId', e.target.value)}
            >
              <option value="">— Tidak ada (level teratas) —</option>
              {parentOptions.map(({ task, depth }) => (
                <option key={task.id} value={task.id}>
                  {'\u00A0\u00A0'.repeat(depth)}
                  {depth > 0 ? '└ ' : ''}
                  {task.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="task-priority">Prioritas</label>
            <select
              id="task-priority"
              value={form.priority}
              onChange={(e) => set('priority', e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="task-start">Tanggal mulai</label>
            <input
              id="task-start"
              type="date"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
            <span className="tag">Selesai (hari kerja): {formatDate(finishPreview)}</span>
          </div>

          <div className="field">
            <label htmlFor="task-duration">Durasi (hari kerja)</label>
            <input
              id="task-duration"
              type="number"
              min={1}
              value={form.durationDays}
              onChange={(e) => set('durationDays', e.target.value)}
            />
            <span className="tag">
              Akhir pekan &amp; hari libur otomatis dilewati ({calendar.weekendDays.length}x akhir
              pekan, {calendar.holidays.length} libur)
            </span>
          </div>

          <div className="field">
            <label htmlFor="task-color">Warna indikator</label>
            <input
              id="task-color"
              type="color"
              value={form.color}
              onChange={(e) => set('color', e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="task-progress">Progres — {form.progress}%</label>
            <input
              id="task-progress"
              type="range"
              min={0}
              max={100}
              step={5}
              value={form.progress}
              onChange={(e) => set('progress', Number(e.target.value))}
            />
          </div>

          <div className="field span-2">
            <label>Alokasi anggota tim</label>
            {resources.length === 0 ? (
              <div className="tag">Belum ada anggota tim. Tambahkan di tab Sumber Daya.</div>
            ) : (
              <div className="row wrap" style={{ gap: 10 }}>
                {resources.map((r) => {
                  const checked = form.resourceIds.includes(r.id)
                  return (
                    <label
                      key={r.id}
                      className="row"
                      style={{
                        gap: 6,
                        border: '1px solid var(--border)',
                        padding: '5px 9px',
                        borderRadius: 8,
                        background: checked ? 'var(--accent-soft)' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        style={{ width: 'auto' }}
                        onChange={() =>
                          set(
                            'resourceIds',
                            checked
                              ? form.resourceIds.filter((id) => id !== r.id)
                              : [...form.resourceIds, r.id],
                          )
                        }
                      />
                      <span style={{ fontWeight: 550 }}>{r.name}</span>
                      <span className="tag">{r.role}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div className="field span-2">
            <label htmlFor="task-notes">Catatan</label>
            <textarea
              id="task-notes"
              value={form.notes}
              placeholder="Keterangan tambahan, deliverable, dsb."
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
        </div>

        <div className="panel" style={{ boxShadow: 'none' }}>
          <div className="panel-head">
            <h2>Estimasi PERT (hari kerja)</h2>
            <span className="hint">
              te = (O + 4M + P) / 6
            </span>
          </div>
          <div className="panel-body form-grid">
            <div className="field">
              <label htmlFor="task-o">Optimis (O)</label>
              <input
                id="task-o"
                type="number"
                min={1}
                value={form.optimistic}
                onChange={(e) => set('optimistic', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="task-m">Paling mungkin (M)</label>
              <input
                id="task-m"
                type="number"
                min={1}
                value={form.mostLikely}
                onChange={(e) => set('mostLikely', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="task-p">Pesimis (P)</label>
              <input
                id="task-p"
                type="number"
                min={1}
                value={form.pessimistic}
                onChange={(e) => set('pessimistic', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="panel" style={{ boxShadow: 'none' }}>
          <div className="panel-head">
            <h2>Predecessor (hubungan antar tugas)</h2>
            <span className="hint">FS = Finish-to-Start, SS = Start-to-Start</span>
          </div>
          <div className="panel-body">
            {!existing ? (
              <div className="tag">
                Simpan tugas terlebih dahulu, lalu buka kembali untuk menambahkan predecessor.
              </div>
            ) : childrenOfExisting ? (
              <div className="tag">
                Tugas ini adalah tugas ringkasan (punya sub-tugas). Hubungan antar tugas hanya
                berlaku untuk tugas daun.
              </div>
            ) : (
              <div className="stack">
                {incoming.length === 0 ? (
                  <div className="tag">Belum ada predecessor.</div>
                ) : (
                  <div className="dep-list">
                    {incoming.map((d) => (
                      <div className="dep-item" key={d.id}>
                        <select
                          value={d.predecessorId}
                          onChange={(e) =>
                            updateDependency(d.id, { predecessorId: e.target.value })
                          }
                        >
                          {leafOptions
                            .filter((t) => t.id !== existing.id)
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                        </select>
                        <select
                          value={d.type}
                          onChange={(e) =>
                            updateDependency(d.id, { type: e.target.value as DependencyType })
                          }
                        >
                          {(['FS', 'SS'] as DependencyType[]).map((type) => (
                            <option key={type} value={type}>
                              {DEPENDENCY_LABELS[type]}
                            </option>
                          ))}
                        </select>
                        <label className="row" style={{ gap: 4 }}>
                          <span className="tag">Jeda</span>
                          <input
                            type="number"
                            value={d.lagDays}
                            onChange={(e) =>
                              updateDependency(d.id, {
                                lagDays: Number(e.target.value) || 0,
                              })
                            }
                          />
                          <span className="tag">hari</span>
                        </label>
                        <button
                          className="icon-btn danger"
                          style={{ marginLeft: 'auto' }}
                          title="Hapus hubungan"
                          onClick={() => deleteDependency(d.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className="row"
                  style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}
                >
                  <button
                    className="btn"
                    onClick={() => {
                      const candidate = leafOptions.find((t) => t.id !== existing.id)
                      if (!candidate) return
                      addDependency({
                        predecessorId: candidate.id,
                        successorId: existing.id,
                        type: 'FS',
                        lagDays: 0,
                      })
                    }}
                  >
                    + Tambah predecessor
                  </button>
                  <span className="tag">
                    Jeda boleh negatif (mis. −2 hari untuk mempercepat).
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
