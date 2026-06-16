/**
 * Park-It shared types — camelCase matching Blink SDK convention.
 *
 * SECURITY NOTES:
 * - Sensitive fields (plateNumber, ownerName, ownerPhone, permitNumber)
 *   are stored encrypted at rest via the enc() helper in lib/crypto.ts.
 *   They appear as plaintext in TypeScript for application-layer usage.
 * - All mutations produce an audit log via lib/audit.ts.
 * - RBAC roles control access: admin > operator > viewer.
 *
 * IMMUTABLE VERIFICATION ROADMAP:
 * - parking_sessions.verification_hash is reserved for future Merkle-chain
 *   or blockchain anchoring. The hash is computed from the session record
 *   + previous hash, forming a tamper-evident log.
 * - audit_logs.prev_hash + record_hash follow the same pattern.
 * - In MVP these are null; the schema is ready for future activation.
 */

// ── Role & Permission types ───────────────────────────────────────

export type AppRole = 'admin' | 'operator' | 'viewer'

export interface PermissionMap {
  dashboard: boolean
  spots: { read: boolean; write: boolean }
  rules: { read: boolean; write: boolean }
  vehicles: { read: boolean; write: boolean }
  sessions: { read: boolean; write: boolean }
  ocr: { read: boolean; write: boolean }
  auditLogs: { read: boolean; write: boolean }
  rbac: { read: boolean; write: boolean }
}

// ── Parking domain models ─────────────────────────────────────────

export interface ParkingSpot {
  id: string
  name: string
  locationName: string
  lat: number
  lng: number
  floor: string
  section: string
  spotType: 'standard' | 'handicap' | 'electric' | 'compact' | 'motorcycle' | 'reserved'
  status: 'available' | 'occupied' | 'maintenance' | 'reserved'
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ParkingRule {
  id: string
  spotId: string
  name: string
  ruleType: 'time_restriction' | 'permit_required' | 'vehicle_type' | 'duration_limit' | 'custom'
  ruleConfig: string // JSON string
  priority: number
  isActive: number // SQLite boolean: "0" or "1"
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface RuleConfigTimeRestriction {
  allowedDays: number[] // 0=Sun..6=Sat
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
  maxDurationMinutes?: number
}

export interface RuleConfigPermitRequired {
  permitTypes: string[]
  requireValidExpiry: boolean
}

export interface RuleConfigVehicleType {
  allowedTypes: string[]
}

export type RuleConfig =
  | RuleConfigTimeRestriction
  | RuleConfigPermitRequired
  | RuleConfigVehicleType

export interface Vehicle {
  id: string
  plateNumber: string // encrypted at rest
  make: string
  model: string
  color: string
  vehicleType: string
  ownerName: string // encrypted at rest
  ownerPhone: string // encrypted at rest
  permitNumber: string
  permitExpiry: string
  isRegistered: number // SQLite boolean: "0" or "1"
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ParkingSession {
  id: string
  spotId: string
  vehicleId: string | null
  plateNumber: string // encrypted at rest
  startTime: string
  endTime: string | null
  status: 'active' | 'completed' | 'violation' | 'cancelled'
  validatedByOcr: number // SQLite boolean
  ocrImageUrl: string
  ocrResult: string // JSON extraction + evaluation
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
  // ── Future immutable verification ──
  verificationHash: string | null // Merkle-chain hash (null in MVP)
}

export interface AuditLog {
  id: string
  userId: string
  userEmail: string
  action: string
  entityType: string
  entityId: string
  changes: string // JSON
  ipAddress: string
  createdAt: string
  // ── Future immutable verification ──
  prevHash: string | null // previous audit hash
  recordHash: string | null // this record's hash
}

export interface RuleEvaluationResult {
  allowed: boolean
  reason: string
  matchedRuleId?: string
  matchedRuleName?: string
}

// ── OCR Scanner types ─────────────────────────────────────────────

export interface OcrExtraction {
  plateNumber: string
  permitNumber: string
  permitExpiry: string
  ownerName: string
  vehicleMake: string
  vehicleModel: string
  vehicleColor: string
  vehicleType: string
  permitType: string
  confidence: number
  notes: string
}

export interface OcrScanResult {
  id: string
  imageUrl: string
  extraction: OcrExtraction
  evaluation: RuleEvaluationResult
  matchedSpot: ParkingSpot | null
  userOverrides?: Partial<OcrExtraction>
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt: string
  createdBy: string
}
