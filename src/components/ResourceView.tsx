import { useMemo, useState } from 'react'
import type { Resource, Task } from '../types'
import { useProjectStore, useSchedule } from '../store/useProjectStore'
import { countWorkingDays } from '../lib/calendar'
import { formatCompactCurrency, formatCurrency, formatNumber } from '../lib/format'
import { ConfirmDialog, Modal } from './ui'

const WORKDAYS_PER_MONTH = 22

interface ResourceForm {
  name: string
  email: string
  role: string
  salary: string
}

export function ResourceView() {
  const resources = useProjectStore((s) => s.resources)
  const tasks = useProjectStore((s) => s.tasks)
  const calendar = useProjectStore((s) => s.calendar)
  const addResource = useProjectStore((s) => s.addResource)
  const updateResource = useProjectStore((s) => s.updateResource)
  const deleteResource = useProjectStore((s) => s.deleteResource)
  const schedule = useSchedule()

  const [editing, setEditing] = useState<Resource | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Resource | null>(null)

  const projectWorkDays = useMemo(() => {
    const cal = { weekendDays: calendar.weekendDays, holidays: calendar.holidays }
    return Math.max(1, countWorkingDays(schedule.projectStart, schedule.projectFinish, cal))
  }, [calendar, schedule.projectStart, schedule.projectFinish])

  const allocation = useMemo(() => {
    const map = new Map<
      string,
      { tasks: Task[]; days: number; cost: number }
    >()
    for (const r of resources) map.set(r.id, { tasks: [], days: 0, cost: 0 })
    for (const task of tasks) {
      const entry = schedule.schedule[task.id]
      if (!entry) continue
      for (const rid of task.resourceIds) {
        const slot = map.get(rid)
        if (!slot) continue
        slot.tasks.push(task)
        slot.days += entry.durationDays
      }
    }
    for (const r of resources) {
      const slot = map.get(r.id)
      if (!slot) continue
      slot.cost = (r.salary / WORKDAYS_PER_MONTH) * slot.days
    }
    return map
  }, [resources, tasks, schedule])

  const totalCost = resources.reduce(
    (sum, r) => sum + (allocation.get(r.id)?.cost ?? 0),
    0,
  )
  const unassigned = tasks.filter(
    (t) => t.resourceIds.length === 0 && !schedule.schedule[t.id]?.isSummary,
  )

  return (
    <div className="view scroll">
      <div className="stat-grid">
        <div className="stat">
          <div className="label">Anggota tim</div>
          <div className="value">{resources.length}</div>
          <div className="sub">Terdaftar di proyek</div>
        </div>
        <div className="stat">
          <div className="label">Total biaya SDM</div>
          <div className="value">{formatCompactCurrency(totalCost)}</div>
          <div className="sub">Gaji / 22 hari × hari kerja teralokasi</div>
        </div>
        <div className="stat">
          <div className="label">Durasi proyek</div>
          <div className="value">{projectWorkDays} hari</div>
          <div className="sub">Hari kerja efektif</div>
        </div>
        <div className="stat">
          <div className="label">Tugas belum dialokasikan</div>
          <div className="value">{unassigned.length}</div>
          <div className="sub">Tanpa anggota tim</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Sumber Daya / Anggota Tim</h2>
          <span className="hint">Nama, email, peran, gaji bulanan, dan alokasi tugas</span>
          <div style={{ flex: 1 }} />
          <button className="btn primary" onClick={() => setEditing('new')}>
            ＋ Anggota Baru
          </button>
        </div>
        <div className="table-scroll" style={{ maxHeight: 460 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Peran</th>
                <th className="num">Gaji / bulan</th>
                <th className="num">Tugas</th>
                <th className="num">Hari kerja</th>
                <th className="num">Utilisasi</th>
                <th className="num">Estimasi biaya</th>
                <th className="center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {resources.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty">Belum ada anggota tim.</div>
                  </td>
                </tr>
              ) : (
                resources.map((r) => {
                  const slot = allocation.get(r.id)
                  const days = slot?.days ?? 0
                  const util = Math.min(100, (days / projectWorkDays) * 100)
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td className="muted">{r.email || '—'}</td>
                      <td>
                        <span className="badge neutral">{r.role}</span>
                      </td>
                      <td className="num mono">{formatCurrency(r.salary)}</td>
                      <td className="num mono">{slot?.tasks.length ?? 0}</td>
                      <td className="num mono">{days}</td>
                      <td className="num mono">{formatNumber(util, 0)}%</td>
                      <td className="num mono">{formatCurrency(slot?.cost ?? 0)}</td>
                      <td className="center">
                        <div className="row" style={{ justifyContent: 'center', gap: 2 }}>
                          <button
                            className="icon-btn"
                            title={`Detail alokasi ${r.name}`}
                            onClick={() => setEditing(r)}
                          >
                            ✎
                          </button>
                          <button
                            className="icon-btn danger"
                            title="Hapus anggota"
                            onClick={() => setPendingDelete(r)}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-head">
            <h2>Alokasi Tugas per Anggota</h2>
          </div>
          <div className="panel-body stack">
            {resources.map((r) => {
              const slot = allocation.get(r.id)
              return (
                <div key={r.id}>
                  <div className="row" style={{ gap: 8 }}>
                    <strong>{r.name}</strong>
                    <span className="tag">{r.role}</span>
                    <span className="tag" style={{ marginLeft: 'auto' }}>
                      {slot?.days ?? 0} hari · {formatCompactCurrency(slot?.cost ?? 0)}
                    </span>
                  </div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    {slot && slot.tasks.length ? (
                      slot.tasks.map((t) => (
                        <span key={t.id} className="badge neutral">
                          <span className="swatch" style={{ background: t.color }} />
                          {t.name}
                        </span>
                      ))
                    ) : (
                      <span className="tag">Belum dialokasikan ke tugas.</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Tugas Tanpa Alokasi</h2>
            <span className="hint">{unassigned.length} tugas</span>
          </div>
          <div className="panel-body stack">
            {unassigned.length === 0 ? (
              <div className="tag">Semua tugas sudah memiliki anggota tim.</div>
            ) : (
              unassigned.map((t) => (
                <div key={t.id} className="row" style={{ gap: 8 }}>
                  <span className="swatch" style={{ background: t.color }} />
                  <span>{t.name}</span>
                  <span className="tag" style={{ marginLeft: 'auto' }}>
                    {schedule.schedule[t.id]?.durationDays ?? t.durationDays} hari
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {editing ? (
        <ResourceEditor
          resource={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(form) => {
            const payload = {
              name: form.name.trim() || 'Tanpa Nama',
              email: form.email.trim(),
              role: form.role.trim() || 'Staff',
              salary: Math.max(0, Number(form.salary) || 0),
            }
            if (editing === 'new') addResource(payload)
            else updateResource(editing.id, payload)
            setEditing(null)
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Hapus anggota tim"
          message={`Hapus "${pendingDelete.name}"? Anggota ini akan dilepas dari semua tugas.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteResource(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      ) : null}
    </div>
  )
}

function ResourceEditor({
  resource,
  onSave,
  onClose,
}: {
  resource: Resource | null
  onSave: (form: ResourceForm) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<ResourceForm>({
    name: resource?.name ?? '',
    email: resource?.email ?? '',
    role: resource?.role ?? '',
    salary: String(resource?.salary ?? 12_000_000),
  })
  const [error, setError] = useState<string | null>(null)

  return (
    <Modal
      title={resource ? 'Ubah Anggota Tim' : 'Anggota Tim Baru'}
      maxWidth={520}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Batal
          </button>
          <button
            className="btn primary"
            onClick={() => {
              if (!form.name.trim()) {
                setError('Nama anggota wajib diisi.')
                return
              }
              onSave(form)
            }}
          >
            Simpan
          </button>
        </>
      }
    >
      <div className="stack">
        {error ? <div className="alert">{error}</div> : null}
        <div className="field">
          <label htmlFor="res-name">Nama lengkap</label>
          <input
            id="res-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="res-email">Email</label>
          <input
            id="res-email"
            type="email"
            value={form.email}
            placeholder="nama@perusahaan.com"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="res-role">Peran</label>
          <input
            id="res-role"
            type="text"
            value={form.role}
            placeholder="Backend Engineer"
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="res-salary">Gaji per bulan (IDR)</label>
          <input
            id="res-salary"
            type="number"
            min={0}
            step={500000}
            value={form.salary}
            onChange={(e) => setForm({ ...form, salary: e.target.value })}
          />
          <span className="tag">
            Estimasi biaya harian: {formatCurrency((Number(form.salary) || 0) / 22)}
          </span>
        </div>
      </div>
    </Modal>
  )
}
