import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Page, PageHeader, PageTitle, PageBody, PageActions, Button, Card, Badge } from '@blinkdotnew/ui'
import { MapPin, Car, Activity, ScanLine, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react'
import { blink } from '@/blink/client'
import { computeKpis, buildWeeklySeries, buildSpotTypeBreakdown, formatNumber } from '@/lib/dashboard-helpers'
import type { ParkingRule, ParkingSession, ParkingSpot, Vehicle, AuditLog } from '@/types/park-it'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { OccupancyChart } from '@/components/dashboard/occupancy-chart'
import { SpotTypeBreakdown } from '@/components/dashboard/spot-type-breakdown'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { UtilizationRing } from '@/components/dashboard/utilization-ring'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Dashboard · Park-It' }, { name: 'description', content: 'Real-time parking operations overview with KPIs, occupancy, and rule enforcement.' }] }),
  component: DashboardPage,
})

function DashboardPage() {
  const spotsQuery = useQuery({ queryKey: ['parking_spots'], queryFn: async () => { const l = await blink.db.table<ParkingSpot>('parking_spots').list(); return Array.isArray(l) ? l : [] } })
  const sessionsQuery = useQuery({ queryKey: ['parking_sessions'], queryFn: async () => { const l = await blink.db.table<ParkingSession>('parking_sessions').list(); return Array.isArray(l) ? l : [] } })
  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: async () => { const l = await blink.db.table<Vehicle>('vehicles').list(); return Array.isArray(l) ? l : [] } })
  const rulesQuery = useQuery({ queryKey: ['parking_rules'], queryFn: async () => { const l = await blink.db.table<ParkingRule>('parking_rules').list(); return Array.isArray(l) ? l : [] } })
  const logsQuery = useQuery({ queryKey: ['audit_logs', 'recent'], queryFn: async () => { const l = await blink.db.table<AuditLog>('audit_logs').list({ orderBy: { createdAt: 'desc' } }); return Array.isArray(l) ? l.slice(0, 8) : [] } })

  const spots = useMemo(() => spotsQuery.data ?? [], [spotsQuery.data])
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data])
  const vehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data])
  const rules = useMemo(() => rulesQuery.data ?? [], [rulesQuery.data])
  const logs = useMemo(() => logsQuery.data ?? [], [logsQuery.data])
  const isLoading = spotsQuery.isLoading || sessionsQuery.isLoading || vehiclesQuery.isLoading || rulesQuery.isLoading
  const kpis = useMemo(() => computeKpis({ spots, sessions, vehicles, rules }), [spots, sessions, vehicles, rules])
  const weekly = useMemo(() => buildWeeklySeries(sessions, spots), [sessions, spots])
  const spotMix = useMemo(() => buildSpotTypeBreakdown(spots), [spots])
  const anyRefreshing = spotsQuery.isFetching || sessionsQuery.isFetching || vehiclesQuery.isFetching || rulesQuery.isFetching

  const refresh = () => { spotsQuery.refetch(); sessionsQuery.refetch(); vehiclesQuery.refetch(); rulesQuery.refetch(); logsQuery.refetch() }

  const recentSessions = useMemo(() => {
    return [...sessions].filter(s => s.status === 'active' || s.status === 'completed').sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).slice(0, 5)
  }, [sessions])

  return (
    <Page>
      <PageHeader>
        <div><PageTitle>Dashboard</PageTitle><p className="text-xs text-muted-foreground">Real-time parking operations overview.</p></div>
        <PageActions>
          <Button variant="outline" size="sm" onClick={refresh} disabled={anyRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${anyRefreshing ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <Button asChild size="sm"><Link to="/ocr"><ScanLine className="h-4 w-4 mr-1.5" />Scan Permit</Link></Button>
        </PageActions>
      </PageHeader>
      <PageBody className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Spots" value={formatNumber(kpis.totalSpots)} icon={<MapPin className="h-4 w-4" />} hint={<>{kpis.availableSpots} available · {kpis.occupiedSpots} occupied</>} accent="info" />
          <KpiCard label="Active Sessions" value={formatNumber(kpis.activeSessions)} icon={<Activity className="h-4 w-4" />} hint={`${kpis.completedToday} completed today`} accent="success" />
          <KpiCard label="Vehicles" value={`${kpis.registeredVehicles} / ${kpis.totalVehicles}`} icon={<Car className="h-4 w-4" />} hint="Registered in registry" accent="default" />
          <KpiCard label="Active Rules" value={formatNumber(kpis.activeRules)} icon={<ShieldCheck className="h-4 w-4" />} hint="Enforced in real-time" accent="info" />
        </div>
        {kpis.violations > 0 && (
          <Card className="p-4 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"><AlertTriangle className="h-4 w-4" /></span>
            <div className="flex-1"><p className="text-xs text-muted-foreground uppercase tracking-wider">Violations</p><p className="text-xl font-semibold tabular-nums">{kpis.violations}</p></div>
          </Card>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1"><UtilizationRing pct={kpis.utilizationPct} total={kpis.totalSpots} occupied={kpis.occupiedSpots} available={kpis.availableSpots} /></div>
          <div className="lg:col-span-2"><OccupancyChart data={weekly} /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <RecentSessionsCard sessions={recentSessions} />
            <RecentActivity logs={logs} />
          </div>
          <div className="space-y-4"><SpotTypeBreakdown data={spotMix} /><QuickActions /></div>
        </div>
        {isLoading && <p className="text-center text-xs text-muted-foreground py-4">Loading latest data…</p>}
      </PageBody>
    </Page>
  )
}

function RecentSessionsCard({ sessions }: { sessions: ParkingSession[] }) {
  if (sessions.length === 0) return (<Card className="p-6"><h3 className="text-sm font-semibold mb-1">Recent Sessions</h3><p className="text-xs text-muted-foreground">No parking sessions yet.</p></Card>)
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-3">Recent Sessions</h3>
      <div className="space-y-2">
        {sessions.map(s => (
          <div key={s.id} className="flex items-center gap-3 rounded-md border border-border p-2.5 hover:bg-muted/30 transition-colors">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0"><Car className="h-4 w-4" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{s.plateNumber || 'No plate'}</p>
              <p className="text-[11px] text-muted-foreground">{new Date(s.startTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {Number(s.validatedByOcr) > 0 && <span className="ml-1.5 inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400"><ScanLine className="h-3 w-3" /> OCR</span>}
              </p>
            </div>
            <Badge variant={s.status === 'active' ? 'default' : s.status === 'violation' ? 'destructive' : 'secondary'} className={s.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : ''}>
              {s.status}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  )
}
