import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Priority, Resource } from '../types'
import { PRIORITY_LABELS } from '../types'
import { initialsOf } from '../lib/format'

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  maxWidth?: number
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal"
        style={maxWidth ? { maxWidth } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{title}</h3>
            {subtitle ? <div className="tag">{subtitle}</div> : null}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Hapus',
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      maxWidth={440}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            Batal
          </button>
          <button className="btn danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge ${priority}`}>{PRIORITY_LABELS[priority]}</span>
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track" title={`${value}%`}>
      <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function Avatar({
  resource,
  title,
}: {
  resource: { name: string; color?: string }
  title?: string
}) {
  const label = initialsOf(resource.name)
  return (
    <span
      className="avatar"
      style={resource.color ? { background: resource.color } : undefined}
      title={title ?? resource.name}
    >
      {label}
    </span>
  )
}

export function AvatarGroup({
  resources,
  max = 3,
}: {
  resources: Resource[]
  max?: number
}) {
  if (!resources.length) return <span className="muted">—</span>
  const shown = resources.slice(0, max)
  const rest = resources.length - shown.length
  return (
    <div className="avatar-group">
      {shown.map((r) => (
        <Avatar key={r.id} resource={r} title={`${r.name} — ${r.role}`} />
      ))}
      {rest > 0 ? (
        <span className="avatar" title={`${rest} anggota lainnya`}>
          +{rest}
        </span>
      ) : null}
    </div>
  )
}
