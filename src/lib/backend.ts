/**
 * Park-It backend client.
 *
 * The backend runs at the platform's `*.backend.blink.new` host. The exact
 * URL is published via `blink_backend_deploy` and never hardcoded here —
 * instead we resolve it once at runtime from the project id baked into
 * `VITE_BLINK_PROJECT_ID` (fallback to the prebaked project id).
 *
 * The base is `https://{last8}.backend.blink.new`. We compute it on first
 * use and cache it.
 */

let _base: string | null = null

function projectId8(): string {
  const id = import.meta.env.VITE_BLINK_PROJECT_ID || "park-it-platform-f1lm8h68"
  return id.slice(-8)
}

export function backendBaseUrl(): string {
  if (_base) return _base
  _base = `https://${projectId8()}.backend.blink.new`
  return _base
}

/**
 * Fetch from the backend with a hard timeout (Workers may take a few
 * hundred ms cold; we cap at 8s to avoid UI hangs).
 */
export async function backendFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 8000
): Promise<T> {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${backendBaseUrl()}${path}`, {
      ...init,
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Backend ${res.status}: ${text.slice(0, 200)}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(tid)
  }
}

export interface AnchorResponse {
  id: string
  prevHash: string
  recordHash: string
  timestamp: string
}

export interface VerifyResponse {
  ok: boolean
  verified: number
  scanned: number
  brokenAt: string | null
  head: string
}

export interface LatestHashResponse {
  latestHash: string
}
