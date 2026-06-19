import { Card, Badge } from '@blinkdotnew/ui'
import { CheckCircle2, XCircle, Activity, Plus, Pencil, Trash2 } from 'lucide-react'
import type { AuditLog } from '@/types/park-it'
import { formatRelativeTime } from '@/lib/dashboard-helpers'
import { ENTITY_LABEL } from '@/lib/audit-helpers'

const ACTION_LABEL_PLAIN: Record<string, string> = {
  create: 'Added',
  update: 'Updated',
  delete: 'Removed',
}

export function RecentActivity({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return (<Card className="p-6"><h3 className="text-sm font-semibold mb-1">Recent Activity</h3><p className="text-xs text-muted-foreground">No activity yet.</p></Card>)
  }
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
      <ul className="space-y-2.5" aria-label="Recent activity log">
        {logs.slice(0, 6).map(log => {
          const entity = ENTITY_LABEL[log.entityType] ?? log.entityType
          const actionLabel = ACTION_LABEL_PLAIN[log.action] ?? log.action
          return (
            <li key={log.id} className="flex items-center gap-3 text-xs">
              <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md shrink-0',
                log.action === 'create' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : log.action === 'update' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
              )} aria-hidden="true">
                {log.action === 'create' ? <Plus className="h-3 w-3" /> : log.action === 'update' ? <Pencil className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-foreground font-medium">{actionLabel}</span> <span className="text-muted-foreground">{entity}</span>
                <p className="text-muted-foreground mt-0.5 truncate">{log.userEmail || 'system'} · {formatRelativeTime(log.createdAt)}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function cn(...classes: (string | boolean | undefined)[]) { return classes.filter(Boolean).join(' ') }
