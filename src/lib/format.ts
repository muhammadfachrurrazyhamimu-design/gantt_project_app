import { MONTH_SHORT, WEEKDAY_LABELS } from '../types'
import { dayOfWeek } from './dateUtils'

const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return idr.format(Math.round(value))
}

export function formatCompactCurrency(value: number): string {
  if (!Number.isFinite(value)) return '-'
  if (Math.abs(value) >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`
  if (Math.abs(value) >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`
  if (Math.abs(value) >= 1_000) return `Rp ${(value / 1_000).toFixed(0)} rb`
  return `Rp ${Math.round(value)}`
}

/** "5 Okt 2026" */
export function formatDate(iso: string): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  const month = MONTH_SHORT[Number(m) - 1] ?? m
  return `${Number(d)} ${month} ${y}`
}

/** "Sen, 5 Okt" */
export function formatDateShort(iso: string): string {
  if (!iso) return '-'
  const [, m, d] = iso.split('-')
  const month = MONTH_SHORT[Number(m) - 1] ?? m
  return `${WEEKDAY_LABELS[dayOfWeek(iso)]}, ${Number(d)} ${month}`
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
