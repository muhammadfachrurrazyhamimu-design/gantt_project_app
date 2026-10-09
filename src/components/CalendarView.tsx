import { useMemo, useState } from 'react'
import { MONTH_SHORT, WEEKDAY_FULL, WEEKDAY_LABELS } from '../types'
import { useProjectStore, useSchedule } from '../store/useProjectStore'
import { countWorkingDays, isWorkingDay } from '../lib/calendar'
import { addDays, eachDay, todayISO } from '../lib/dateUtils'
import { formatDate, formatDateShort } from '../lib/format'

export function CalendarView() {
  const calendar = useProjectStore((s) => s.calendar)
  const updateCalendar = useProjectStore((s) => s.updateCalendar)
  const toggleWeekendDay = useProjectStore((s) => s.toggleWeekendDay)
  const addHoliday = useProjectStore((s) => s.addHoliday)
  const removeHoliday = useProjectStore((s) => s.removeHoliday)
  const schedule = useSchedule()

  const [holidayInput, setHolidayInput] = useState(addDays(todayISO(), 1))

  const cal = { weekendDays: calendar.weekendDays, holidays: calendar.holidays }

  const projectWorkDays = useMemo(
    () => countWorkingDays(schedule.projectStart, schedule.projectFinish, cal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule.projectStart, schedule.projectFinish, calendar],
  )

  const preview = useMemo(() => {
    const start = calendar.projectStart
    return eachDay(start, addDays(start, 13)).map((iso) => ({
      iso,
      working: isWorkingDay(iso, cal),
      holiday: calendar.holidays.includes(iso),
      weekend: calendar.weekendDays.includes(new Date(`${iso}T00:00:00Z`).getUTCDay()),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar])

  const sortedHolidays = [...calendar.holidays].sort()

  return (
    <div className="view scroll">
      <div className="stat-grid">
        <div className="stat">
          <div className="label">Hari kerja proyek</div>
          <div className="value">{projectWorkDays} hari</div>
          <div className="sub">
            {formatDate(schedule.projectStart)} → {formatDate(schedule.projectFinish)}
          </div>
        </div>
        <div className="stat">
          <div className="label">Akhir pekan</div>
          <div className="value">{calendar.weekendDays.length} hari</div>
          <div className="sub">
            {calendar.weekendDays.length
              ? calendar.weekendDays.map((d) => WEEKDAY_FULL[d]).join(', ')
              : 'Tidak ada'}
          </div>
        </div>
        <div className="stat">
          <div className="label">Hari libur khusus</div>
          <div className="value">{calendar.holidays.length}</div>
          <div className="sub">Dikecualikan dari perhitungan durasi</div>
        </div>
        <div className="stat">
          <div className="label">Mulai proyek</div>
          <div className="value" style={{ fontSize: 16 }}>
            {formatDateShort(calendar.projectStart)}
          </div>
          <div className="sub">Acuan jadwal awal</div>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-head">
            <h2>Pengaturan Akhir Pekan</h2>
            <span className="hint">Klik hari untuk menandai sebagai akhir pekan</span>
          </div>
          <div className="panel-body stack">
            <div className="weekday-toggles">
              {WEEKDAY_FULL.map((label, day) => {
                const on = calendar.weekendDays.includes(day)
                return (
                  <button
                    key={label}
                    className={`weekday-toggle${on ? ' on' : ''}`}
                    onClick={() => toggleWeekendDay(day)}
                    title={on ? `${label} adalah akhir pekan` : `${label} adalah hari kerja`}
                  >
                    {label}
                    <div className="tag">{on ? 'libur' : 'kerja'}</div>
                  </button>
                )
              })}
            </div>
            <div className="tag">
              Perubahan langsung menghitung ulang seluruh jadwal, termasuk tanggal selesai dan
              jalur kritis.
            </div>

            <div className="field" style={{ maxWidth: 260 }}>
              <label htmlFor="project-start">Tanggal mulai proyek</label>
              <input
                id="project-start"
                type="date"
                value={calendar.projectStart}
                onChange={(e) =>
                  e.target.value && updateCalendar({ projectStart: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Hari Libur Khusus</h2>
            <span className="hint">{calendar.holidays.length} hari</span>
          </div>
          <div className="panel-body stack">
            <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="holiday-input">Tanggal libur</label>
                <input
                  id="holiday-input"
                  type="date"
                  value={holidayInput}
                  onChange={(e) => setHolidayInput(e.target.value)}
                />
              </div>
              <button
                className="btn primary"
                onClick={() => {
                  if (holidayInput) addHoliday(holidayInput)
                }}
              >
                ＋ Tambah
              </button>
            </div>

            {sortedHolidays.length === 0 ? (
              <div className="tag">Belum ada hari libur khusus.</div>
            ) : (
              <div className="holiday-list">
                {sortedHolidays.map((iso) => (
                  <div className="holiday-item" key={iso}>
                    <span className="badge neutral">{WEEKDAY_LABELS[weekdayOf(iso)]}</span>
                    <span>{formatDate(iso)}</span>
                    <span className="tag">
                      {MONTH_SHORT[Number(iso.slice(5, 7)) - 1]} {iso.slice(0, 4)}
                    </span>
                    <button
                      className="icon-btn danger"
                      style={{ marginLeft: 'auto' }}
                      title="Hapus hari libur"
                      onClick={() => removeHoliday(iso)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Pratinjau 2 Minggu Pertama</h2>
          <span className="hint">Abu-abu = akhir pekan, merah = hari libur</span>
        </div>
        <div className="panel-body">
          <div className="row wrap" style={{ gap: 8 }}>
            {preview.map((d) => (
              <div
                key={d.iso}
                className="stat"
                style={{
                  minWidth: 92,
                  background: d.holiday ? '#fee2e2' : d.weekend ? '#f1f5f9' : '#dcfce7',
                  padding: '8px 10px',
                }}
              >
                <div className="label">{WEEKDAY_LABELS[weekdayOf(d.iso)]}</div>
                <div style={{ fontWeight: 700 }}>{d.iso.slice(8, 10)}</div>
                <div className="tag">{MONTH_SHORT[Number(d.iso.slice(5, 7)) - 1]}</div>
                <div className="tag">{d.holiday ? 'libur' : d.holiday || d.weekend ? 'libur' : 'kerja'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay()
}
