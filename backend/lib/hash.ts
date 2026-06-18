/**
 * SHA-256 hash helpers — Web Crypto API (available in Cloudflare Workers).
 *
 * The hash chain is:
 *   recordHash = sha256(prevHash | action | entityType | entityId | changes | timestamp)
 *
 * The `|` separator is fine because none of the input fields can contain `|`
 * by construction (changes is JSON-encoded, IDs are alphanumerics).
 */

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export interface HashInput {
  prevHash: string
  action: string
  entityType: string
  entityId: string
  changes: string
  timestamp: string
}

export async function recordHash(input: HashInput): Promise<string> {
  const payload = [
    input.prevHash,
    input.action,
    input.entityType,
    input.entityId,
    input.changes,
    input.timestamp,
  ].join("|")
  return sha256(payload)
}
