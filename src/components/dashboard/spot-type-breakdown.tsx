import { Card } from '@blinkdotnew/ui'
import { cn } from '@/lib/utils'

const TYPE_META: Record<string, { label: string; color: string }> = {
  standard: { label: 'Standard', color: 'bg-slate-500' },
  handicap: { label: 'Handicap', color: 'bg-blue-500' },
  electric: { label: 'Electric', color: 'bg-emerald-500' },
  compact: { label: 'Compact', color: 'bg-gray-500' },
  motorcycle: { label: 'Motorcycle', color: 'bg-orange-500' },
  reserved: { label: 'Reserved', color: 'bg-purple-500' },
}

export function SpotTypeBreakdown({ data }: { data: Array<{ type: string; count: number }> }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return (<Card className="p-6"><h3 className="text-sm font-semibold mb-1">Spot Mix</h3><p className="text-xs text-muted-foreground">No spots configured.</p></Card>)

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-3">Spot Mix</h3>
      <div className="space-y-3">
        {data.map(d => {
          const meta = TYPE_META[d.type] ?? { label: d.type, color: 'bg-muted-foreground' }
          const pct = (d.count / total) * 100
          return (
            <div key={d.type} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2 font-medium">
                  <span className={cn('h-2 w-2 rounded-full', meta.color)} aria-hidden="true" />
                  {meta.label}
                </span>
                <span className="text-muted-foreground tabular-nums">{d.count} <span className="text-[10px]">({pct.toFixed(0)}%)</span></span>
              </div>
              <div
                className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuenow={d.count}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label={`${meta.label}: ${d.count} of ${total} spots (${pct.toFixed(0)}%)`}
              >
                <div className={cn('h-full rounded-full transition-all', meta.color)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
