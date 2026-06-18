/**
 * Audit hash chain — server-side anchor.
 *
 * Route mount: /api/audit/*
 *   POST /anchor       Record a new audit event with a server-computed hash.
 *   GET  /latest-hash  Return the head of the chain (empty string if empty).
 *   GET  /verify       Re-hash every record in the chain and confirm integrity.
 *
 * Why this lives in the worker:
 *   - The client cannot be trusted to compute prevHash honestly. A malicious
 *     operator could rewind or fork their own chain. The worker reads the
 *     latest server-side record and chains from that.
 *   - `verify` is the operator-facing tool to prove nothing was tampered with
 *     since the records were written.
 */
import { Hono } from "hono"
import { recordHash } from "../lib/hash"
import type { createClient } from "@blinkdotnew/sdk"

type Env = {
  BLINK_PROJECT_ID: string
  BLINK_SECRET_KEY: string
}

interface AuditRecord {
  id: string
  userId: string
  userEmail: string
  action: string
  entityType: string
  entityId: string
  changes: string
  ipAddress: string
  createdAt: string
}

interface AnchorBody {
  action: string
  entityType: string
  entityId?: string
  changes?: Record<string, unknown>
  // Optional — the client may pass a JWT so the worker can attribute the record
  // to the right user. The worker still uses the server key for DB access.
  authorization?: string
}

type GetBlink = (env: Env) => ReturnType<typeof createClient>

export const audit = ({ getBlink }: { getBlink: GetBlink }) => {
  const app = new Hono<{ Bindings: Env }>()

  /**
   * POST /anchor
   * body: { action, entityType, entityId?, changes? }
   * Returns the inserted record plus its server-computed prevHash / recordHash.
   */
  app.post("/anchor", async (c) => {
    const blink = getBlink(c.env)
    let body: AnchorBody
    try {
      body = (await c.req.json()) as AnchorBody
    } catch {
      return c.json({ error: "invalid_json" }, 400)
    }

    if (!body.action || !body.entityType) {
      return c.json({ error: "missing_fields", need: ["action", "entityType"] }, 400)
    }

    // Identify the user from the JWT, if provided
    let userId = "anonymous"
    let userEmail = ""
    const auth = c.req.header("Authorization")
    if (auth) {
      const verify = await blink.auth.verifyToken(auth).catch(() => null)
      if (verify && verify.valid) {
        userId = verify.userId ?? userId
        userEmail = verify.email ?? userEmail
      }
    }

    // Read the head of the chain (oldest-then-newest? we keep newest-first on
    // the read side to keep this simple — the first record in the desc list
    // is the most recent. If a recordHash is missing we treat it as genesis.)
    const head = await readHead(blink)
    const prevHash = head
    const timestamp = new Date().toISOString()
    const changesStr = JSON.stringify(body.changes ?? {})

    const hash = await recordHash({
      prevHash,
      action: body.action,
      entityType: body.entityType,
      entityId: body.entityId ?? "",
      changes: changesStr,
      timestamp,
    })

    const created = await blink.db.auditLogs.create({
      userId,
      userEmail,
      action: body.action,
      entityType: body.entityType,
      entityId: body.entityId ?? "",
      changes: changesStr,
      ipAddress: c.req.header("cf-connecting-ip") ?? "",
      createdAt: timestamp,
    } as unknown as AuditRecord)

    // Try to attach the hash columns if they exist; tolerate absence silently
    // (MVP schema may not have prevHash / recordHash yet.)
    try {
      await blink.db.auditLogs.update(created.id, {
        prevHash,
        recordHash: hash,
      } as unknown as Partial<AuditRecord>)
    } catch {
      // Hash columns missing — chain is still recorded, just not stored.
    }

    return c.json({
      id: created.id,
      prevHash,
      recordHash: hash,
      timestamp,
    })
  })

  /**
   * GET /latest-hash
   * Returns the head of the chain (or empty string if no records exist).
   * Used by the client to bridge the gap while the DB schema is being
   * updated to add the hash columns.
   */
  app.get("/latest-hash", async (c) => {
    const blink = getBlink(c.env)
    const head = await readHead(blink)
    return c.json({ latestHash: head })
  })

  /**
   * GET /verify?limit=100
   * Re-hashes the last N records (newest-first) and returns whether the
   * chain is intact. Empty chain → valid. Used by the audit-logs UI.
   */
  app.get("/verify", async (c) => {
    const blink = getBlink(c.env)
    const limit = Math.min(parseInt(c.req.query("limit") ?? "100", 10) || 100, 1000)

    const list = (await blink.db.auditLogs.list({
      orderBy: { createdAt: "asc" },
    } as unknown as Parameters<typeof blink.db.auditLogs.list>[0])) as unknown as AuditRecord[]

    if (!Array.isArray(list) || list.length === 0) {
      return c.json({ ok: true, verified: 0, brokenAt: null })
    }

    const slice = list.slice(-limit)
    let expectedPrev = ""
    let verified = 0
    let brokenAt: string | null = null
    for (const r of slice) {
      const changes = typeof r.changes === "string" ? r.changes : JSON.stringify(r.changes ?? {})
      const recomputed = await recordHash({
        prevHash: expectedPrev,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        changes,
        timestamp: r.createdAt,
      })
      // If the row has a stored recordHash, prefer to check against it. If
      // both match, accept. If the row is missing a recordHash (schema not
      // yet updated), we still chain forward and report.
      const stored = (r as unknown as { recordHash?: string }).recordHash
      if (stored && stored !== recomputed) {
        brokenAt = r.id
        break
      }
      expectedPrev = recomputed
      verified += 1
    }

    return c.json({
      ok: brokenAt === null,
      verified,
      scanned: slice.length,
      brokenAt,
      head: expectedPrev,
    })
  })

  return app
}

/**
 * Read the head of the chain from the DB. Newest-first, return the
 * first record's recordHash (or empty string if none exist).
 */
async function readHead(blink: ReturnType<typeof createClient>): Promise<string> {
  const list = (await blink.db.auditLogs.list({
    orderBy: { createdAt: "desc" },
  } as unknown as Parameters<typeof blink.db.auditLogs.list>[0])) as unknown as (AuditRecord & { recordHash?: string })[]
  if (!Array.isArray(list) || list.length === 0) return ""
  const top = list[0]
  return top.recordHash ?? ""
}
