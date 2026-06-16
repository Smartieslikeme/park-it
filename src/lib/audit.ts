import { blink } from '@/blink/client'
import type { AuditLog } from '@/types/park-it'

/**
 * Audit logging for Park-It with verification hash chain.
 *
 * SECURITY DESIGN:
 * - Every mutation (create/update/delete) calls auditLog() after success.
 * - Never throws — logs to console on failure so mutations aren't blocked.
 * - Stores user identity, entity type, entity ID, and a JSON diff of changes.
 *
 * IMMUTABLE VERIFICATION:
 * - Each audit record is hashed with SHA-256.
 * - The hash includes the previous record's hash (prevHash), forming a chain.
 * - In MVP the hash columns exist in the DB but are stored as plain text.
 * - Future: backend trigger will enforce the chain server-side and optionally
 *   anchor to a blockchain for tamper-proof verification.
 */

/**
 * Compute a SHA-256 hash of a string. Returns hex digest.
 * Uses Web Crypto API — available in all modern browsers.
 */
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Build the verification hash payload for an audit record.
 * The hash covers: prevHash + action + entityType + entityId + changes + timestamp.
 */
async function computeRecordHash(params: {
  prevHash: string
  action: string
  entityType: string
  entityId: string
  changes: string
  timestamp: string
}): Promise<string> {
  const payload = [
    params.prevHash,
    params.action,
    params.entityType,
    params.entityId,
    params.changes,
    params.timestamp,
  ].join('|')
  return sha256(payload)
}

/**
 * Get the most recent audit record's hash for chaining.
 * Returns empty string if no prior records exist.
 */
async function getLatestHash(): Promise<string> {
  try {
    const list = await blink.db.table<AuditLog>('audit_logs').list({
      orderBy: { createdAt: 'desc' },
    })
    const arr = Array.isArray(list) ? list : []
    if (arr.length > 0 && arr[0].recordHash) {
      return arr[0].recordHash
    }
    return ''
  } catch {
    return ''
  }
}

/**
 * Record an audit log entry with verification hash chain.
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
    const timestamp = new Date().toISOString()
    const changesStr = JSON.stringify(params.changes ?? {})
    const entityId = params.entityId ?? ''

    // Compute verification hash chain
    const prevHash = await getLatestHash()
    const recordHash = await computeRecordHash({
      prevHash,
      action: params.action,
      entityType: params.entityType,
      entityId,
      changes: changesStr,
      timestamp,
    })

    await blink.db.auditLogs.create({
      userId: user?.id ?? 'anonymous',
      userEmail: user?.email ?? '',
      action: params.action,
      entityType: params.entityType,
      entityId,
      changes: changesStr,
      ipAddress: '',
      createdAt: timestamp,
    } as AuditLog)

    // Update the record with hash values (create returns the record)
    // Note: In a backend deployment, the hash would be computed server-side.
    // For MVP, we store it after creation via a second write if the columns exist.
    // The DB schema may not have these columns yet — gracefully skip.
    try {
      // Attempt to find and update the just-created record
      const latest = await blink.db.table<AuditLog>('audit_logs').list({
        orderBy: { createdAt: 'desc' },
      })
      const arr = Array.isArray(latest) ? latest : []
      if (arr.length > 0 && arr[0].userId === (user?.id ?? 'anonymous')) {
        // Try to update hash columns — will silently fail if columns don't exist
        await blink.db.table<AuditLog>('audit_logs').update(arr[0].id, {
          prevHash,
          recordHash,
        } as Partial<AuditLog>).catch(() => {
          // Columns don't exist yet — expected in MVP until schema migration
        })
      }
    } catch {
      // Hash storage is non-critical — audit log is already recorded
    }
  } catch (err) {
    console.error('[auditLog] Failed to record:', err)
  }
}
