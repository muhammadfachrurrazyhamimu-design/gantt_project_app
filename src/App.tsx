import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { ProjectData } from './types'
import { useProjectStore, useSchedule } from './store/useProjectStore'
import { GanttView } from './components/GanttView'
import { ResourceView } from './components/ResourceView'
import { CalendarView } from './components/CalendarView'
import { AnalysisView } from './components/AnalysisView'
import { countWorkingDays } from './lib/calendar'
import { formatDate } from './lib/format'

type TabId = 'gantt' | 'resources' | 'calendar' | 'analysis'

const TABS: { id: TabId; label: string }[] = [
  { id: 'gantt', label: 'Gantt & Tugas' },
  { id: 'resources', label: 'Sumber Daya' },
  { id: 'calendar', label: 'Kalender Proyek' },
  { id: 'analysis', label: 'Analisis (CPM & PERT)' },
]

function initialTab(): TabId {
  const hash = window.location.hash.replace('#', '')
  return TABS.some((t) => t.id === hash) ? (hash as TabId) : 'gantt'
}

export default function App() {
  const [tab, setTab] = useState<TabId>(initialTab)

  // Keep the URL hash in sync so a view can be linked to / refreshed.
  useEffect(() => {
    if (window.location.hash.replace('#', '') !== tab) {
      window.location.hash = tab
    }
  }, [tab])
  const name = useProjectStore((s) => s.name)
  const setName = useProjectStore((s) => s.setName)
  const tasks = useProjectStore((s) => s.tasks)
  const dependencies = useProjectStore((s) => s.dependencies)
  const resources = useProjectStore((s) => s.resources)
  const calendar = useProjectStore((s) => s.calendar)
  const importData = useProjectStore((s) => s.importData)
  const resetToSample = useProjectStore((s) => s.resetToSample)
  const schedule = useSchedule()

  const fileRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const workDays = countWorkingDays(schedule.projectStart, schedule.projectFinish, {
    weekendDays: calendar.weekendDays,
    holidays: calendar.holidays,
  })

  const exportJson = () => {
    const data: ProjectData = { name, tasks, dependencies, resources, calendar }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/\s+/g, '-').toLowerCase() || 'proyek'}.json`
    a.click()
    URL.revokeObjectURL(url)
    setNotice('Data proyek diunduh sebagai JSON.')
  }

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as ProjectData
      if (!Array.isArray(parsed.tasks) || !parsed.calendar) {
        throw new Error('format')
      }
      importData({
        name: parsed.name ?? 'Proyek Impor',
        tasks: parsed.tasks,
        dependencies: parsed.dependencies ?? [],
        resources: parsed.resources ?? [],
        calendar: parsed.calendar,
      })
      setNotice(`Berhasil mengimpor ${parsed.tasks.length} tugas.`)
    } catch {
      setNotice('Gagal mengimpor berkas: format JSON tidak sesuai.')
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">▦</div>
          <div style={{ minWidth: 0 }}>
            <input
              className="brand-title"
              style={{
                border: '1px solid transparent',
                background: 'transparent',
                padding: '2px 4px',
                width: 300,
              }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Nama proyek"
            />
            <div className="brand-sub">
              {tasks.length} tugas · {resources.length} anggota · {workDays} hari kerja ·{' '}
              {formatDate(schedule.projectStart)} → {formatDate(schedule.projectFinish)}
            </div>
          </div>
        </div>

        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="header-spacer" />

        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={exportJson}>
            Ekspor JSON
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Impor JSON
          </button>
          <button
            className="btn danger"
            onClick={() => {
              resetToSample()
              setNotice('Data contoh dimuat ulang.')
            }}
          >
            Reset Contoh
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={onImportFile}
          />
        </div>
      </header>

      <main className="app-main">
        {notice ? (
          <div className="alert row" style={{ gap: 10 }}>
            <span>{notice}</span>
            <button
              className="btn tiny"
              style={{ marginLeft: 'auto' }}
              onClick={() => setNotice(null)}
            >
              Tutup
            </button>
          </div>
        ) : null}

        {tab === 'gantt' ? <GanttView /> : null}
        {tab === 'resources' ? <ResourceView /> : null}
        {tab === 'calendar' ? <CalendarView /> : null}
        {tab === 'analysis' ? <AnalysisView /> : null}
      </main>
    </div>
  )
}
