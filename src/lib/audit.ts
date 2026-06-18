import { blink } from '@/blink/client'
import type { AuditLog } from '@/types/park-it'
import { backendFetch, type AnchorResponse } from '@/lib/backend'

/**
 * Audit logging for Park-It.
 *
 * SECURITY DESIGN:
 * - Every mutation (create/update/delete) calls auditLog() after success.
 * - Never throws — logs to console on failure so mutations aren't blocked.
 * - Stores user identity, entity type, entity ID, and a JSON diff of changes.
 *
 * IMMUTABLE VERIFICATION (server-anchored):
 * - The audit hash chain is computed SERVER-SIDE in the Blink backend worker
 *   (see `backend/routes/audit.ts`).
 * - On each call we POST to the backend's /api/audit/anchor endpoint. The
 *   worker reads the head of the chain from the DB, computes SHA-256 over
 *   (prevHash | action | entityType | entityId | changes | timestamp), and
 *   persists the record with its hash.
 * - The local `blink.db.auditLogs.create` here remains as a fallback so the
 *   audit is still recorded if the backend is unreachable. When the worker
 *   IS reachable, the chain it builds is the source of truth.
 * - The local `prevHash` / `recordHash` columns are best-effort — the schema
 *   may not have them yet. The worker stores the chain in its own way.
 */

const BACKEND_TIMEOUT_MS = 6000

/**
 * Compute a SHA-256 hash of a string. Returns hex digest.
 * Used as a local fallback if the backend is unreachable.
 */
export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Build the verification hash payload for an audit record.
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
 * Get the most recent audit record's hash for chaining (local fallback).
 */
async function getLatestHash(): Promise<string> {
  try {
    const list = await blink.db.auditLogs.list({
      orderBy: { createdAt: 'desc' },
    } as unknown as Parameters<typeof blink.db.auditLogs.list>[0])
    const arr = Array.isArray(list) ? list : []
    if (arr.length > 0 && (arr[0] as { recordHash?: string }).recordHash) {
      return (arr[0] as unknown as { recordHash: string }).recordHash
    }
    return ''
  } catch {
    return ''
  }
}

/**
 * Record an audit log entry.
 *
 * Strategy:
 *   1. Try the backend anchor endpoint (server-side chain). On success, the
 *      record's prevHash/recordHash are computed authoritatively. We then
 *      upsert the row into the local audit_logs table so the UI sees it.
 *   2. If the backend is unreachable, fall back to a local client-side
 *      hash so the audit is still recorded. The chain will not be tamper-
 *      evident in this mode — a banner in the audit-logs UI warns users.
 */
export async function auditLog(params: {
  action: string
  entityType: string
  entityId?: string
  changes?: Record<string, unknown>
}): Promise<void> {
  const changesStr = JSON.stringify(params.changes ?? {})
  const entityId = params.entityId ?? ''

  // Resolve the caller's identity for the audit row.
  let userId = 'anonymous'
  let userEmail = ''
  try {
    const me = await blink.auth.me().catch(() => null)
    if (me) {
      userId = (me as { id?: string }).id ?? userId
      userEmail = (me as { email?: string }).email ?? userEmail
    }
  } catch { /* anonymous */ }

  // ── 1) Try the server-side anchor first ────────────────────────────
  try {
    const anchored = await backendFetch<AnchorResponse>(
      '/api/audit/anchor',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: params.action,
          entityType: params.entityType,
          entityId,
          changes: params.changes ?? {},
        }),
      },
      BACKEND_TIMEOUT_MS,
    )

    // Mirror the server-anchored record into the local audit_logs table so
    // the UI's React Query cache sees it. The hash columns are best-effort.
    try {
      await blink.db.auditLogs.create({
        userId,
        userEmail,
        action: params.action,
        entityType: params.entityType,
        entityId,
        changes: changesStr,
        ipAddress: '',
        createdAt: anchored.timestamp,
      } as unknown as AuditLog)

      const latest = (await blink.db.auditLogs.list({
        orderBy: { createdAt: 'desc' },
      } as unknown as Parameters<typeof blink.db.auditLogs.list>[0])) as unknown as AuditLog[]
      const arr = Array.isArray(latest) ? latest : []
      if (arr.length > 0 && arr[0].userId === userId) {
        await blink.db.auditLogs.update(arr[0].id, {
          prevHash: anchored.prevHash,
          recordHash: anchored.recordHash,
        } as unknown as Partial<AuditLog>).catch(() => { /* columns missing */ })
      }
    } catch {
      // Local mirror failed — that's fine, the worker has the canonical record.
    }
    return
  } catch (err) {
    console.warn('[auditLog] Backend unreachable, falling back to local chain:', err)
  }

  // ── 2) Local fallback (no backend) ─────────────────────────────────
  try {
    const prevHash = await getLatestHash()
    const timestamp = new Date().toISOString()
    const recordHash = await computeRecordHash({
      prevHash,
      action: params.action,
      entityType: params.entityType,
      entityId,
      changes: changesStr,
      timestamp,
    })

    await blink.db.auditLogs.create({
      userId,
      userEmail,
      action: params.action,
      entityType: params.entityType,
      entityId,
      changes: changesStr,
      ipAddress: '',
      createdAt: timestamp,
    } as unknown as AuditLog)

    try {
      const latest = (await blink.db.auditLogs.list({
        orderBy: { createdAt: 'desc' },
      } as unknown as Parameters<typeof blink.db.auditLogs.list>[0])) as unknown as AuditLog[]
      const arr = Array.isArray(latest) ? latest : []
      if (arr.length > 0 && arr[0].userId === userId) {
        await blink.db.auditLogs.update(arr[0].id, {
          prevHash,
          recordHash,
        } as unknown as Partial<AuditLog>).catch(() => { /* columns missing */ })
      }
    } catch {
      // Hash update is best-effort
    }
  } catch (err) {
    console.error('[auditLog] Failed to record:', err)
  }
}

/**
 * Re-verify the audit chain integrity by calling the backend.
 * Returns a structured result the UI can render.
 */
export interface ChainVerifyResult {
  ok: boolean
  verified: number
  scanned: number
  brokenAt: string | null
  head: string
  reachable: boolean
}

export async function verifyChain(limit = 100): Promise<ChainVerifyResult> {
  try {
    const { backendFetch } = await import('@/lib/backend')
    const r = await backendFetch<{ ok: boolean; verified: number; scanned: number; brokenAt: string | null; head: string }>(
      `/api/audit/verify?limit=${limit}`,
      { method: 'GET' },
      BACKEND_TIMEOUT_MS,
    )
    return { ...r, reachable: true }
  } catch (err) {
    console.warn('[verifyChain] Backend unreachable:', err)
    return { ok: false, verified: 0, scanned: 0, brokenAt: null, head: '', reachable: false }
  }
}
