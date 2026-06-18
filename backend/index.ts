/**
 * Park-It backend — Hono on Cloudflare Workers for Platforms.
 *
 * SHAPE
 * - One entry point: this file. Mounts all route modules.
 * - Uses `blink` SDK with `secretKey` (server-only) so we can call
 *   blink.db / blink.auth from the worker without needing a JWT.
 * - CORS enabled for browser calls.
 *
 * WHY A BACKEND AT ALL
 * The audit hash chain is the one piece of logic that MUST live server-side:
 *   - If we let the client compute `prevHash`, a malicious user can rewrite
 *     their own chain. Server-side, every audit insert computes the chain
 *     from the last server-known record.
 *   - The `verify` route lets an operator prove a chain segment is intact
 *     by re-hashing it from the DB.
 *
 * v1 routes (added on demand, not before):
 *   GET  /health                  → liveness
 *   POST /api/audit/anchor        → record an audit event, server hashes it
 *   GET  /api/audit/verify        → re-hash a chain segment, return integrity result
 *   GET  /api/audit/latest-hash   → peek at the head of the chain
 */
import { Hono } from "hono"
import { cors } from "hono/cors"
import { createClient } from "@blinkdotnew/sdk"
import { audit } from "./routes/audit"

type Env = {
  BLINK_PROJECT_ID: string
  BLINK_SECRET_KEY: string
  BLINK_PUBLISHABLE_KEY: string
}

const getBlink = (env: Env) =>
  createClient({
    projectId: env.BLINK_PROJECT_ID,
    secretKey: env.BLINK_SECRET_KEY,
  })

const app = new Hono<{ Bindings: Env }>()

// CORS for browser → backend calls
app.use("*", cors())

// Liveness
app.get("/health", (c) => c.json({ ok: true, service: "park-it-backend" }))

// Mount audit routes
app.route("/api/audit", audit({ getBlink }))

// Catch-all 404 with the same shape so the frontend can branch on `error`
app.notFound((c) =>
  c.json({ error: "not_found", path: c.req.path }, 404)
)

export default app
