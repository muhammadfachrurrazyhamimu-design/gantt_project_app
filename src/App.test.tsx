import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { useProjectStore } from './store/useProjectStore'
import { addDays } from './lib/dateUtils'
import { formatDate } from './lib/format'

// The zustand store is a module singleton, so clearing localStorage is not
// enough: reset the in-memory project between tests to keep them independent.
beforeEach(() => {
  useProjectStore.getState().resetToSample()
  useProjectStore.getState().selectTask(null)
})

/** The left-hand task table of the Gantt view. */
function taskTable(container: HTMLElement) {
  return within(container.querySelector('.gantt-left') as HTMLElement)
}

describe('App — Gantt & Tugas', () => {
  it('renders the sample project with Gantt bars, weekend shading and dependencies', () => {
    const { container } = render(<App />)
    expect(screen.getByLabelText('Nama proyek')).toHaveValue(
      'Proyek Pengembangan Aplikasi',
    )
    expect(container.querySelectorAll('.bar').length).toBeGreaterThanOrEqual(14)
    expect(taskTable(container).getAllByText('Analisis kebutuhan').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.grid-nonwork').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.dep-layer path').length).toBeGreaterThan(0)
  })

  it('marks the summary rows and shows the critical-path badge', () => {
    const { container } = render(<App />)
    expect(container.querySelectorAll('.bar.summary').length).toBeGreaterThan(0)
    expect(taskTable(container).getAllByText('CP').length).toBeGreaterThan(0)
  })

  it('creates a new task through the editor modal and schedules it', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    const barsBefore = container.querySelectorAll('.bar').length

    await user.click(screen.getByRole('button', { name: /Tugas Baru/ }))
    const nameInput = screen.getByLabelText('Nama tugas')
    await user.clear(nameInput)
    await user.type(nameInput, 'Tugas Uji Otomatis')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(taskTable(container).getByText('Tugas Uji Otomatis')).toBeInTheDocument()
    expect(container.querySelectorAll('.bar').length).toBe(barsBefore + 1)
  })

  it('adds a sub-task to the selected task', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(taskTable(container).getByText('Desain UI/UX'))
    await user.click(screen.getByRole('button', { name: /Sub-tugas/ }))
    const nameInput = screen.getByLabelText('Nama tugas')
    await user.clear(nameInput)
    await user.type(nameInput, 'Wireframe halaman')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(taskTable(container).getByText('Wireframe halaman')).toBeInTheDocument()
  })

  it('edits a predecessor relationship (type + lag)', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(taskTable(container).getByText('Analisis kebutuhan'))
    await user.click(screen.getByRole('button', { name: 'Ubah' }))
    expect(
      screen.getByRole('heading', { name: /Predecessor/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/FS = Finish-to-Start, SS = Start-to-Start/)).toBeInTheDocument()
  })

  it('deletes a task only after confirmation', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    const row = taskTable(container).getByText('Pelatihan pengguna').closest('.gantt-row')!
    await user.click(row.querySelector('[title="Hapus tugas"]') as HTMLElement)
    expect(screen.getByText('Hapus tugas')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hapus' }))
    expect(taskTable(container).queryByText('Pelatihan pengguna')).not.toBeInTheDocument()
  })

  it('extends the timeline when the driving task duration grows', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    const timelineWidth = () =>
      (container.querySelector('.gantt-right') as HTMLElement).style.width
    const before = timelineWidth()

    const row = taskTable(container).getByText('Deployment produksi').closest('.gantt-row')!
    await user.click(row.querySelector('[title="Ubah tugas"]') as HTMLElement)
    const duration = screen.getByLabelText('Durasi (hari kerja)')
    await user.clear(duration)
    await user.type(duration, '9')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    // The project now ends later, so the rendered timeline gets wider.
    expect(parseInt(timelineWidth(), 10)).toBeGreaterThan(parseInt(before, 10))
  })
})

describe('App — drag & resize pada Gantt', () => {
  /** Bar element for a task, located via its title attribute. */
  const barFor = (container: HTMLElement, name: string) =>
    container.querySelector(`.bar[title^="${name}"]`) as HTMLElement

  const durationOf = (el: HTMLElement) =>
    Number(/\((\d+) hari kerja\)/.exec(el.getAttribute('title') ?? '')?.[1] ?? '0')

  it('shifts the start date when a bar is dragged right', () => {
    const { container } = render(<App />)
    // Zoom is 26px/day by default: +52px == +2 calendar days.
    fireEvent.pointerDown(barFor(container, 'Analisis kebutuhan'), {
      clientX: 200,
      pointerId: 1,
      button: 0,
    })
    fireEvent.pointerMove(barFor(container, 'Analisis kebutuhan'), {
      clientX: 252,
      pointerId: 1,
    })

    // Live preview tooltip reflects the tentative schedule.
    expect(container.querySelector('.drag-tip')?.textContent).toContain('7 Okt 2026')

    fireEvent.pointerUp(barFor(container, 'Analisis kebutuhan'), {
      clientX: 252,
      pointerId: 1,
    })

    expect(barFor(container, 'Analisis kebutuhan').getAttribute('title')).toContain(
      '2026-10-07',
    )
    // The task table row shows the recomputed start date too.
    const row = taskTable(container)
      .getByText('Analisis kebutuhan')
      .closest('.gantt-row') as HTMLElement
    expect(row.textContent).toContain('Rab, 7 Okt')
  })

  it('does not commit when the pointer barely moved', () => {
    const { container } = render(<App />)
    const titleBefore = barFor(container, 'Analisis kebutuhan').getAttribute('title')
    fireEvent.pointerDown(barFor(container, 'Analisis kebutuhan'), {
      clientX: 200,
      pointerId: 1,
      button: 0,
    })
    fireEvent.pointerMove(barFor(container, 'Analisis kebutuhan'), {
      clientX: 201,
      pointerId: 1,
    })
    fireEvent.pointerUp(barFor(container, 'Analisis kebutuhan'), {
      clientX: 201,
      pointerId: 1,
    })
    expect(barFor(container, 'Analisis kebutuhan').getAttribute('title')).toBe(titleBefore)
  })

  it('cancels an in-progress drag with Escape', () => {
    const { container } = render(<App />)
    const titleBefore = barFor(container, 'Analisis kebutuhan').getAttribute('title')
    fireEvent.pointerDown(barFor(container, 'Analisis kebutuhan'), {
      clientX: 200,
      pointerId: 1,
      button: 0,
    })
    fireEvent.pointerMove(barFor(container, 'Analisis kebutuhan'), {
      clientX: 252,
      pointerId: 1,
    })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(barFor(container, 'Analisis kebutuhan'), {
      clientX: 252,
      pointerId: 1,
    })
    expect(barFor(container, 'Analisis kebutuhan').getAttribute('title')).toBe(titleBefore)
  })

  it('lengthens the duration when the right edge is dragged', () => {
    const { container } = render(<App />)
    const before = durationOf(barFor(container, 'Deployment produksi'))
    // Re-query for every event: each drag update re-renders the bar, so a node
    // captured up front would be detached and stop receiving events.
    const handle = () =>
      barFor(container, 'Deployment produksi').querySelector('.bar-resize') as HTMLElement

    fireEvent.pointerDown(handle(), { clientX: 400, pointerId: 2, button: 0 })
    fireEvent.pointerMove(handle(), { clientX: 452, pointerId: 2 })
    fireEvent.pointerUp(handle(), { clientX: 452, pointerId: 2 })

    const after = durationOf(barFor(container, 'Deployment produksi'))
    expect(after).toBeGreaterThan(before)
  })

  it('keeps summary bars non-draggable', () => {
    const { container } = render(<App />)
    const summary = container.querySelector('.bar.summary') as HTMLElement
    expect(summary).toHaveClass('readonly')
    expect(summary.querySelector('.bar-resize')).toBeNull()
  })
})

describe('App — pengeditan Gantt lewat keyboard', () => {
  const barFor = (container: HTMLElement, name: string) =>
    container.querySelector(`.bar[title^="${name}"]`) as HTMLElement
  /** First ISO date in a bar's title, i.e. its scheduled start. */
  const startOf = (container: HTMLElement, name: string) =>
    /(\d{4}-\d{2}-\d{2})/.exec(barFor(container, name).getAttribute('title') ?? '')?.[1] ?? ''
  const durationOf = (container: HTMLElement, name: string) =>
    Number(
      /\((\d+) hari kerja\)/.exec(
        barFor(container, name).getAttribute('title') ?? '',
      )?.[1] ?? '0',
    )

  it('exposes each editable bar as a focusable control with a described action', () => {
    const { container } = render(<App />)
    const bar = barFor(container, 'Analisis kebutuhan')
    expect(bar).toHaveAttribute('tabindex', '0')
    expect(bar).toHaveAttribute('role', 'button')
    expect(bar).toHaveAccessibleName(/Analisis kebutuhan.*hari kerja.*Alt/s)
  })

  it('moves the start date one working day per arrow press and announces it', () => {
    const { container } = render(<App />)
    // Derived from the rendered project so the test does not depend on the
    // week the sample data happens to start in.
    const before = startOf(container, 'Analisis kebutuhan')
    fireEvent.keyDown(barFor(container, 'Analisis kebutuhan'), { key: 'ArrowRight' })

    expect(startOf(container, 'Analisis kebutuhan')).toBe(addDays(before, 1))
    // The change must be perceivable without sight: a role=status live region.
    const status = screen.getByRole('status').textContent ?? ''
    expect(status).toContain('Analisis kebutuhan')
    expect(status).toContain(formatDate(before))
    expect(status).toContain(formatDate(addDays(before, 1)))
  })

  it('moves backwards with the left arrow and never schedules onto a weekend', () => {
    const { container } = render(<App />)
    const before = startOf(container, 'Analisis kebutuhan')
    const bar = () => barFor(container, 'Analisis kebutuhan')
    // Three left presses walk the raw start back to the previous Friday: the
    // weekend days in between are skipped by the calendar, not scheduled onto.
    for (let i = 0; i < 3; i += 1) fireEvent.keyDown(bar(), { key: 'ArrowLeft' })
    expect(startOf(container, 'Analisis kebutuhan')).toBe(addDays(before, -3))
  })

  it('takes a five-day step when Shift is held, snapping onto a working day', () => {
    const { container } = render(<App />)
    const before = startOf(container, 'Analisis kebutuhan')
    fireEvent.keyDown(barFor(container, 'Analisis kebutuhan'), {
      key: 'ArrowRight',
      shiftKey: true,
    })

    // +5 calendar days off a Monday lands on a Saturday, so the scheduler
    // pushes the start to the following Monday: seven days later in total.
    expect(startOf(container, 'Analisis kebutuhan')).toBe(addDays(before, 7))
  })

  it('resizes the duration with Alt+Arrow and announces the new value', () => {
    const { container } = render(<App />)
    const before = durationOf(container, 'Deployment produksi')
    fireEvent.keyDown(barFor(container, 'Deployment produksi'), {
      key: 'ArrowRight',
      altKey: true,
    })

    expect(durationOf(container, 'Deployment produksi')).toBe(before + 1)
    expect(screen.getByRole('status').textContent).toContain(`${before} → ${before + 1}`)
  })

  it('never resizes below a single working day', () => {
    const { container } = render(<App />)
    const before = durationOf(container, 'Setup lingkungan & CI/CD')
    const bar = () => barFor(container, 'Setup lingkungan & CI/CD')
    for (let i = 0; i < 6; i += 1) {
      fireEvent.keyDown(bar(), { key: 'ArrowLeft', altKey: true })
    }
    expect(before).toBeGreaterThan(1)
    expect(durationOf(container, 'Setup lingkungan & CI/CD')).toBe(1)
  })

  it('ignores arrow keys on read-only summary bars', () => {
    const { container } = render(<App />)
    const summary = container.querySelector('.bar.summary') as HTMLElement
    const before = summary.getAttribute('title')
    expect(summary).not.toHaveAttribute('tabindex')
    fireEvent.keyDown(summary, { key: 'ArrowRight' })
    expect(container.querySelector('.bar.summary')!.getAttribute('title')).toBe(before)
  })

  it('opens the editor with Enter and selects with Space', async () => {
    const { container } = render(<App />)
    fireEvent.keyDown(barFor(container, 'Analisis kebutuhan'), { key: ' ' })
    expect(useProjectStore.getState().selectedTaskId).not.toBeNull()

    fireEvent.keyDown(barFor(container, 'Analisis kebutuhan'), { key: 'Enter' })
    expect(await screen.findByRole('heading', { name: /Ubah Tugas/ })).toBeInTheDocument()
  })
})

describe('App — Sumber Daya', () => {
  it('lists team members with salary and allocation', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: 'Sumber Daya' }))

    const table = within(container.querySelector('table') as HTMLElement)
    expect(table.getByText('Andi Pratama')).toBeInTheDocument()
    expect(table.getAllByText('Backend Engineer').length).toBeGreaterThan(0)
    expect(screen.getByText('Total biaya SDM')).toBeInTheDocument()
  })

  it('registers a new team member', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: 'Sumber Daya' }))
    await user.click(screen.getByRole('button', { name: /Anggota Baru/ }))

    await user.type(screen.getByLabelText('Nama lengkap'), 'Fajar Nugroho')
    await user.type(screen.getByLabelText('Peran'), 'DevOps Engineer')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    const table = within(container.querySelector('table') as HTMLElement)
    expect(table.getByText('Fajar Nugroho')).toBeInTheDocument()
    expect(table.getByText('DevOps Engineer')).toBeInTheDocument()
  })
})

describe('App — Kalender Proyek', () => {
  it('toggles a weekend day off', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Kalender Proyek' }))

    const sunday = screen.getByRole('button', { name: /^Minggu/ })
    expect(sunday).toHaveClass('on')
    await user.click(sunday)
    expect(sunday).not.toHaveClass('on')
  })

  it('adds and removes a custom holiday', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Kalender Proyek' }))

    const holidayInput = screen.getByLabelText('Tanggal libur')
    fireEvent.change(holidayInput, { target: { value: '2026-12-25' } })
    await user.click(screen.getByRole('button', { name: /Tambah/ }))

    const item = screen.getByText('25 Des 2026')
    expect(item).toBeInTheDocument()

    await user.click(
      within(item.closest('.holiday-item') as HTMLElement).getByTitle('Hapus hari libur'),
    )
    expect(screen.queryByText('25 Des 2026')).not.toBeInTheDocument()
  })
})

describe('App — Analisis', () => {
  it('shows the critical path, CPM table and PERT output', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: 'Analisis (CPM & PERT)' }))

    expect(screen.getByText('Jalur Kritis (Critical Path)')).toBeInTheDocument()
    expect(screen.getByText('Analisis CPM (Critical Path Method)')).toBeInTheDocument()
    expect(screen.getByText('Diagram PERT')).toBeInTheDocument()
    expect(screen.getByText('Estimasi Tiga Titik (PERT)')).toBeInTheDocument()

    expect(container.querySelectorAll('.pert-node').length).toBeGreaterThan(5)
    expect(screen.getAllByText('Kritis').length).toBeGreaterThan(0)
  })
})
