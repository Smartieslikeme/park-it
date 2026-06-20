import { blink } from '@/blink/client'

/* ── Types ──────────────────────────────────────────────────────────────── */

/** What the AI extracts from a parking sign image. */
export interface SignExtraction {
  signText: string
  isAllowed: boolean
  reason: string
  restrictions: string
  maxMinutes: number
}

/** Row shape for the `scans` table. */
export interface Scan {
  id: string
  userId: string
  signDescription: string
  ruleText: string
  isAllowed: number       // SQLite "0" | "1"
  reason: string
  restrictions: string
  timerDurationMinutes: number
  timerExpiresAt: string
  lat: number
  lng: number
  createdAt: string
}

/* ── AI Extraction ──────────────────────────────────────────────────────── */

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    signText:        { type: 'string',  description: 'All text visible on the sign' },
    isAllowed:       { type: 'boolean', description: 'Whether parking is currently allowed given the current day and time' },
    reason:          { type: 'string',  description: 'Clear, concise reason why or why not' },
    restrictions:    { type: 'string',  description: 'Summary of all parking restrictions shown on the sign' },
    maxMinutes:      { type: 'number',  description: 'Maximum parking duration in minutes (0 if unlimited, 0 if not shown)' },
  },
  required: ['signText', 'isAllowed', 'reason'],
} as const

/**
 * Upload image → AI extract → delete image.
 * Privacy-first: the photo is deleted from storage immediately after extraction.
 */
export async function processParkingSign(file: File): Promise<SignExtraction> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `ocr-signs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { publicUrl } = await blink.storage.upload(file, path)

  try {
    const { object } = await blink.ai.generateObject({
      prompt: [
        'You are a parking-sign analyst for Park-It.',
        `Current time: ${new Date().toLocaleString()}.`,
        '',
        'Analyze the parking sign in this image.  Extract:',
        '1. signText — every word visible on the sign',
        '2. isAllowed — can a driver park here RIGHT NOW?',
        '3. reason — short explanation',
        '4. restrictions — human-readable summary of all rules',
        '5. maxMinutes — max parking duration (0 = unlimited or not shown)',
        '',
        'Be precise about time/day restrictions.',
        '',
        `Image URL: ${publicUrl}`,
      ].join('\n'),
      schema: EXTRACTION_SCHEMA,
    } as unknown as Parameters<typeof blink.ai.generateObject>[0])

    return object as SignExtraction
  } finally {
    // Privacy: delete the image immediately.
    try { await blink.storage.remove(path) } catch { /* best-effort */ }
  }
}

/* ── Timer Helpers ──────────────────────────────────────────────────────── */

/** How many seconds remain on a timer that expires at `expiresAt`. */
export function secondsRemaining(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.floor(ms / 1000))
}

/** Format seconds → "12:34" (mm:ss) or "1h 02m" if ≥ 1 hour. */
export function formatTimer(totalSec: number): string {
  if (totalSec <= 0) return '0:00'
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Human-readable "Leave by 4:30 PM" string. */
export function leaveByTime(expiresAt: string): string {
  return new Date(expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Human-readable relative time ("3 min ago"). */
export function timeAgo(dateStr: string): string {
  const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (sec < 60)   return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return new Date(dateStr).toLocaleDateString()
}
