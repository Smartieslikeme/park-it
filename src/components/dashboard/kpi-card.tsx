import type { ReactNode } from 'react'
import { Card } from '@blinkdotnew/ui'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode
  accent?: 'default' | 'success' | 'warning' | 'destructive' | 'info'; className?: string
}

const ACCENT_BG: Record<string, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  destructive: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
}

export function KpiCard({ label, value, hint, icon, accent = 'default', className }: KpiCardProps) {
  return (
    <Card className={cn('p-5 flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className={cn('inline-flex items-center justify-center h-8 w-8 rounded-md shrink-0', ACCENT_BG[accent])}>{icon}</span>
      </div>
      <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
      {hint && <p className="text-xs text-muted-foreground -mt-1">{hint}</p>}
    </Card>
  )
}
