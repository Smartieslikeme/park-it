import { useAuth } from '@/hooks/useAuth'
import type { PermissionMap } from '@/types/park-it'
import { Card } from '@blinkdotnew/ui'
import { ShieldX, LogIn } from 'lucide-react'
import { Button } from '@blinkdotnew/ui'
import { roleLabel } from '@/lib/rbac'

/**
 * Permission guard — renders children only if the user has the required permission.
 * Shows an access-denied card with the user's current role and a login prompt.
 *
 * Usage:
 *   <PermissionGuard module="vehicles" permission="write">
 *     <Button>Delete</Button>
 *   </PermissionGuard>
 */

type ModuleKey = Exclude<keyof PermissionMap, 'dashboard'>

interface PermissionGuardProps {
  module: ModuleKey
  permission?: 'read' | 'write'
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGuard({
  module,
  permission = 'read',
  children,
  fallback,
}: PermissionGuardProps) {
  const { permissions, role, user, login, isLoading } = useAuth()

  if (isLoading) return null

  // Not logged in
  if (!user) {
    if (fallback) return <>{fallback}</>
    return (
      <Card className="p-8 flex flex-col items-center gap-3 text-center max-w-md mx-auto">
        <LogIn className="h-8 w-8 text-muted-foreground" />
        <h2 className="text-base font-semibold">Sign in required</h2>
        <p className="text-xs text-muted-foreground">
          You need to sign in to access this page.
        </p>
        <Button onClick={login} size="sm">Sign in</Button>
      </Card>
    )
  }

  // Check permission
  const modPerm = permissions[module]
  const hasPermission = typeof modPerm === 'boolean'
    ? modPerm
    : modPerm
      ? modPerm[permission]
      : false

  if (hasPermission) return <>{children}</>

  // Access denied
  if (fallback) return <>{fallback}</>
  return (
    <Card className="p-8 flex flex-col items-center gap-3 text-center max-w-md mx-auto">
      <ShieldX className="h-8 w-8 text-rose-500" />
      <h2 className="text-base font-semibold">Access denied</h2>
      <p className="text-xs text-muted-foreground">
        Your role (<strong>{roleLabel(role)}</strong>) does not have{' '}
        <strong>{permission}</strong> access to <strong>{module}</strong>.
        <br />
        Contact an administrator to upgrade your permissions.
      </p>
    </Card>
  )
}

/**
 * Inline permission check — renders children only if the user has the permission,
 * otherwise renders nothing (no fallback card). Good for hiding buttons/links.
 */
export function Can({
  module,
  permission = 'read',
  children,
}: {
  module: ModuleKey
  permission?: 'read' | 'write'
  children: React.ReactNode
}) {
  const { permissions, user, isLoading } = useAuth()
  if (isLoading || !user) return null
  const modPerm = permissions[module]
  const has = typeof modPerm === 'boolean' ? modPerm : modPerm ? modPerm[permission] : false
  return has ? <>{children}</> : null
}
