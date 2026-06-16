import type { AuditLog } from '@/types/park-it'

export const ACTION_OPTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
] as const

export const ENTITY_OPTIONS = [
  { value: 'all', label: 'All entities' },
  { value: 'parking_spot', label: 'Spot' },
  { value: 'parking_rule', label: 'Rule' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'parking_session', label: 'Session' },
  { value: 'ocr_scan', label: 'OCR Scan' },
] as const

export const ACTION_LABEL: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
}

export const ENTITY_LABEL: Record<string, string> = {
  parking_spot: 'Spot',
  parking_rule: 'Rule',
  vehicle: 'Vehicle',
  parking_session: 'Session',
  ocr_scan: 'OCR Scan',
}

export interface AuditLogFilter {
  search: string
  action: string
  entity: string
}

export function filterLogs(logs: AuditLog[], filter: AuditLogFilter): AuditLog[] {
  const q = filter.search.trim().toLowerCase()
  return logs.filter((l) => {
    if (filter.action !== 'all' && l.action !== filter.action) return false
    if (filter.entity !== 'all' && l.entityType !== filter.entity) return false
    if (!q) return true
    return (
      l.userEmail?.toLowerCase().includes(q) ||
      l.userId?.toLowerCase().includes(q) ||
      l.entityId?.toLowerCase().includes(q) ||
      l.entityType?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.changes?.toLowerCase().includes(q)
    )
  })
}

export function parseChanges(changes: string): Record<string, unknown> {
  if (!changes) return {}
  try { return JSON.parse(changes) } catch { return { raw: changes } }
}
