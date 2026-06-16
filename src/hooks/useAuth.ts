import { useState, useEffect, useCallback } from 'react'
import type { BlinkUser } from '@blinkdotnew/sdk'
import { blink } from '@/blink/client'
import type { AppRole, PermissionMap } from '@/types/park-it'
import { parseRole, getPermissions } from '@/lib/rbac'

/**
 * Central auth hook for Park-It.
 *
 * SECURITY DESIGN:
 * - Only sets isLoading → false (never back to true) to prevent blank-screen cycles.
 * - Auto-promotes the first authenticated user to 'admin' if no role is set.
 * - Derives RBAC permissions from the user's role.
 * - Exposes login/logout for managed-mode auth.
 *
 * ROLE STORAGE:
 * - Roles are stored in Blink user metadata: { role: 'admin' | 'operator' | 'viewer' }
 * - On first login, if metadata.role is missing, set it to 'admin'.
 */

interface AuthState {
  user: BlinkUser | null
  isLoading: boolean
  role: AppRole
  permissions: PermissionMap
  login: () => void
  logout: () => void
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<BlinkUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [role, setRole] = useState<AppRole>('viewer')

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged(async (state) => {
      setUser(state.user)
      if (!state.isLoading) setIsLoading(false)

      if (state.user) {
        const metadata = state.user.metadata as Record<string, unknown> | undefined
        const rawRole = metadata?.role
        if (rawRole) {
          setRole(parseRole(rawRole))
        } else {
          // First user auto-promotion to admin
          try {
            await blink.auth.updateMe({
              metadata: { ...metadata, role: 'admin' },
            })
            setRole('admin')
          } catch {
            setRole('viewer')
          }
        }
      } else {
        setRole('viewer')
      }
    })
    return unsubscribe
  }, [])

  const login = useCallback(() => blink.auth.login(), [])
  const logout = useCallback(() => blink.auth.logout(), [])

  const permissions = getPermissions(role)

  return { user, isLoading, role, permissions, login, logout }
}
