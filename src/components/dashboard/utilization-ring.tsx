import { Card } from '@blinkdotnew/ui'
import { cn } from '@/lib/utils'

interface Props { pct: number; total: number; occupied: number; available: number }

export function UtilizationRing({ pct, total, occupied, available }: Props) {
  const radius = 56; const stroke = 10
  const circumference = 2 * Math.PI * radius
  const safePct = Math.max(0, Math.min(100, pct))
  const offset = circumference - (safePct / 100) * circumference
  const color = safePct >= 90 ? 'text-rose-500' : safePct >= 70 ? 'text-amber-500' : 'text-emerald-500'

  return (
    <Card className="p-5 flex flex-col">
      <h3 className="text-sm font-semibold">Utilization</h3>
      <p className="text-xs text-muted-foreground mb-3">Real-time spot occupancy</p>
      <div className="flex items-center gap-4 flex-1">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
            <circle cx="70" cy="70" r={radius} fill="none" strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={cn('transition-all duration-500', color)} style={{ stroke: 'currentColor' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums tracking-tight">{safePct}%</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{total} spots</span>
          </div>
        </div>
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-rose-500" />Occupied</span>
            <span className="font-semibold tabular-nums">{occupied}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-500" />Available</span>
            <span className="font-semibold tabular-nums">{available}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
