import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page, PageHeader, PageTitle, PageBody, Card, Badge, Button, toast } from '@blinkdotnew/ui'
import { ShieldCheck, Plus, MapPin, Car, ScanLine, ClipboardList, Settings } from 'lucide-react'
import { blink } from '@/blink/client'
import type { ParkingSpot, ParkingRule, ParkingSession, Vehicle } from '@/types/park-it'

export const Route = createFileRoute('/rules')({
  head: () => ({ meta: [{ title: 'Rules · Park-It' }] }),
  component: RulesPage,
})

function RulesPage() {
  const rulesQuery = useQuery({ queryKey: ['parking_rules'], queryFn: async () => { const l = await blink.db.table<ParkingRule>('parking_rules').list({ orderBy: { priority: 'asc' } }); return Array.isArray(l) ? l : [] } })
  const spotsQuery = useQuery({ queryKey: ['parking_spots'], queryFn: async () => { const l = await blink.db.table<ParkingSpot>('parking_spots').list(); return Array.isArray(l) ? l : [] } })

  const rules = rulesQuery.data ?? []
  const spots = spotsQuery.data ?? []
  const spotMap = useMemo(() => { const m: Record<string, ParkingSpot> = {}; for (const s of spots) m[s.id] = s; return m }, [spots])

  return (
    <Page>
      <PageHeader><PageTitle>Parking Rules</PageTitle></PageHeader>
      <PageBody className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Active Rules ({rules.filter(r => Number(r.isActive) > 0).length})</h3>
          </div>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules configured yet. Rules are evaluated when scanning permits.</p>
          ) : (
            <div className="space-y-2">
              {rules.map(r => (
                <div key={r.id} className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/30 transition-colors">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0"><ShieldCheck className="h-4 w-4" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">{spotMap[r.spotId]?.name || r.spotId}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{r.ruleType.replace('_', ' ')}</Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">P{r.priority}</span>
                  <Badge variant={Number(r.isActive) > 0 ? 'default' : 'secondary'} className={Number(r.isActive) > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : ''}>
                    {Number(r.isActive) > 0 ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </PageBody>
    </Page>
  )
}
