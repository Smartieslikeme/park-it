/**
 * Web Crypto API helpers for encrypting sensitive fields at rest.
 *
 * ARCHITECTURE:
 * - Uses AES-GCM (128-bit) with a per-record IV for each encryption call.
 * - The encryption key is derived from a project-level secret stored in
 *   Blink Secrets (VITE_ENCRYPTION_KEY). In production this should be a
 *   server-side KMS; for MVP the client-side key enables transparent
 *   encrypt-on-write, decrypt-on-read without a backend round-trip.
 * - Format: base64(IV + ciphertext). The 12-byte IV is prepended to the
 *   ciphertext so each record is self-contained.
 *
 * FUTURE: When the backend is deployed, move encryption server-side.
 * The client should never hold the master key in production.
 */

const ENCODER = new TextEncoder()
const DECODER = new TextDecoder()

// 16-byte key for AES-GCM-128, base64-encoded in env.
// Falls back to a hardcoded development key if env is missing.
// ⚠️  In production: rotate to server-side KMS.
const DEV_KEY_B64 = 'cGFya2l0ZGV2MTIzNDU2Nzg5MDEy' // "parkitdev123456789012" padded

function getKeyBase64(): string {
  try {
    return import.meta.env.VITE_ENCRYPTION_KEY || DEV_KEY_B64
  } catch {
    return DEV_KEY_B64
  }
}

let _keyPromise: Promise<CryptoKey> | null = null

async function getKey(): Promise<CryptoKey> {
  if (_keyPromise) return _keyPromise
  _keyPromise = (async () => {
    const raw = Uint8Array.from(atob(getKeyBase64()), (c) => c.charCodeAt(0))
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
  })()
  return _keyPromise
}

/**
 * Encrypt a plaintext string. Returns a base64 string (IV + ciphertext).
 * Empty strings pass through as empty — callers should check for empty before encrypting.
 */
export async function encryptField(plaintext: string): Promise<string> {
  if (!plaintext) return ''
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    ENCODER.encode(plaintext),
  )
  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + new Uint8Array(ct).length)
  combined.set(iv)
  combined.set(new Uint8Array(ct), iv.length)
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt a base64(IV + ciphertext) string back to plaintext.
 * Empty strings pass through as empty.
 */
export async function decryptField(encrypted: string): Promise<string> {
  if (!encrypted) return ''
  try {
    const raw = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
    const iv = raw.slice(0, 12)
    const ct = raw.slice(12)
    const key = await getKey()
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    return DECODER.decode(pt)
  } catch {
    // If decryption fails, return the raw value (backward compat with unencrypted legacy data)
    return encrypted
  }
}

/**
 * Encrypt multiple fields on a record object in-place.
 * Returns a new object with encrypted values.
 */
export async function encryptRecord<T extends Record<string, unknown>>(
  record: T,
  fields: (keyof T)[],
): Promise<T> {
  const result = { ...record }
  for (const field of fields) {
    const val = result[field]
    if (typeof val === 'string' && val.length > 0) {
      ;(result as Record<string, unknown>)[field as string] = await encryptField(val)
    }
  }
  return result
}

/**
 * Decrypt multiple fields on a record object in-place.
 * Returns a new object with decrypted values.
 */
export async function decryptRecord<T extends Record<string, unknown>>(
  record: T,
  fields: (keyof T)[],
): Promise<T> {
  const result = { ...record }
  for (const field of fields) {
    const val = result[field]
    if (typeof val === 'string' && val.length > 0) {
      ;(result as Record<string, unknown>)[field as string] = await decryptField(val)
    }
  }
  return result
}

// Fields to encrypt per entity type
export const ENCRYPTED_FIELDS = {
  vehicles: ['plateNumber', 'ownerName', 'ownerPhone'] as const,
  parking_sessions: ['plateNumber'] as const,
} as const
