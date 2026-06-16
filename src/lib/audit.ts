import { blink } from '@/blink/client'
import type { AuditLog } from '@/types/park-it'

/**
 * Audit logging for Park-It.
 *
 * SECURITY DESIGN:
 * - Every mutation (create/update/delete) calls auditLog() after success.
 * - Never throws — logs to console on failure so mutations aren't blocked.
 * - Stores user identity, entity type, entity ID, and a JSON diff of changes.
 *
 * IMMUTABLE VERIFICATION ROADMAP:
 * - The schema includes prev_hash and record_hash columns.
 * - In MVP these are left null. When the backend is deployed, a trigger
 *   will compute SHA-256(prev_hash + record_data) to form a tamper-evident
 *   chain, enabling future blockchain anchoring without schema changes.
 */
export async function auditLog(params: {
  action: string
  entityType: string
  entityId?: string
  changes?: Record<string, unknown>
}): Promise<void> {
  try {
    const state = await blink.auth.me().catch(() => null)
    const user = state ? (state as { id?: string; email?: string }) : null

    await blink.db.auditLogs.create({
      userId: user?.id ?? 'anonymous',
      userEmail: user?.email ?? '',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? '',
      changes: JSON.stringify(params.changes ?? {}),
      ipAddress: '',
    } as AuditLog)
  } catch (err) {
    console.error('[auditLog] Failed to record:', err)
  }
}
