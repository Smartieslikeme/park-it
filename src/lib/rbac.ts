import type { AppRole, PermissionMap } from '@/types/park-it'

/**
 * Role-based access control (RBAC) for Park-It.
 *
 * ARCHITECTURE:
 * - Roles are stored in the Blink user metadata field.
 * - The first user to sign up is auto-promoted to admin (via useAuth hook).
 * - Permissions are derived from role — no per-user overrides in MVP.
 *
 * FUTURE: When the backend is deployed, role checks should also happen
 * server-side. Client-side RBAC is a UX convenience, not a security boundary.
 */

const ROLE_HIERARCHY: Record<AppRole, number> = {
  admin: 100,
  operator: 50,
  viewer: 10,
}

/**
 * Check if roleA has at least the authority of roleB.
 */
export function roleAtLeast(roleA: AppRole, roleB: AppRole): boolean {
  return (ROLE_HIERARCHY[roleA] ?? 0) >= (ROLE_HIERARCHY[roleB] ?? 0)
}

/**
 * Derive the full permission map for a role.
 */
export function getPermissions(role: AppRole): PermissionMap {
  switch (role) {
    case 'admin':
      return {
        dashboard: true,
        spots: { read: true, write: true },
        rules: { read: true, write: true },
        vehicles: { read: true, write: true },
        sessions: { read: true, write: true },
        ocr: { read: true, write: true },
        auditLogs: { read: true, write: true },
        rbac: { read: true, write: true },
      }
    case 'operator':
      return {
        dashboard: true,
        spots: { read: true, write: true },
        rules: { read: true, write: true },
        vehicles: { read: true, write: true },
        sessions: { read: true, write: true },
        ocr: { read: true, write: true },
        auditLogs: { read: true, write: false },
        rbac: { read: false, write: false },
      }
    case 'viewer':
    default:
      return {
        dashboard: true,
        spots: { read: true, write: false },
        rules: { read: true, write: false },
        vehicles: { read: true, write: false },
        sessions: { read: true, write: false },
        ocr: { read: false, write: false },
        auditLogs: { read: true, write: false },
        rbac: { read: false, write: false },
      }
  }
}

/**
 * Parse a role string from user metadata, defaulting to 'viewer'.
 */
export function parseRole(raw: unknown): AppRole {
  if (raw === 'admin' || raw === 'operator' || raw === 'viewer') return raw
  return 'viewer'
}

/**
 * Human-readable role label.
 */
export function roleLabel(role: AppRole): string {
  switch (role) {
    case 'admin':
      return 'Administrator'
    case 'operator':
      return 'Operator'
    case 'viewer':
    default:
      return 'Viewer'
  }
}

/**
 * Role badge color classes (Tailwind).
 */
export function roleBadgeClass(role: AppRole): string {
  switch (role) {
    case 'admin':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
    case 'operator':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
    case 'viewer':
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-300 border-slate-200 dark:border-slate-700'
  }
}
