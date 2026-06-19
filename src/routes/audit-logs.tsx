import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Page, PageHeader, PageTitle, PageBody, PageActions, Button, Card, Badge, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, EmptyState } from '@blinkdotnew/ui'
import { Search, ClipboardList, Plus, Pencil, Trash2, ChevronRight, ShieldCheck, ShieldX, RefreshCw, Loader2 } from 'lucide-react'
import { blink } from '@/blink/client'
import type { AuditLog } from '@/types/park-it'
import { ACTION_LABEL, ENTITY_LABEL, ACTION_OPTIONS, ENTITY_OPTIONS, filterLogs, parseChanges } from '@/lib/audit-helpers'
import { formatRelativeTime } from '@/lib/dashboard-helpers'
import { verifyChain, type ChainVerifyResult } from '@/lib/audit'

export const Route = createFileRoute('/audit-logs')({
  head: () => ({ meta: [{ title: 'Audit Logs · Park-It' }, { name: 'description', content: 'Full audit trail of every administrative action. Server-anchored hash chain for tamper-evident verification.' }] }),
  component: AuditLogsPage,
})

function AuditLogsPage() {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('all')
  const [entity, setEntity] = useState('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [verify, setVerify] = useState<ChainVerifyResult | null>(null)
  const [verifying, setVerifying] = useState(false)

  const logsQuery = useQuery({ queryKey: ['audit_logs'], queryFn: async () => { const l = await blink.db.auditLogs.list({ orderBy: { createdAt: 'desc' } }); return Array.isArray(l) ? l : [] } })
  const logs = logsQuery.data ?? []
  const filtered = useMemo(() => filterLogs(logs, { search, action, entity }), [logs, search, action, entity])
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const runVerify = async () => {
    setVerifying(true)
    try {
      const r = await verifyChain(100)
      setVerify(r)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Page>
      <PageHeader>
        <div><PageTitle>Audit Logs</PageTitle><p className="text-xs text-muted-foreground">{logs.length} total event{logs.length === 1 ? '' : 's'} · server-anchored chain</p></div>
        <PageActions>
          <Button variant="outline" size="sm" onClick={runVerify} disabled={verifying}>
            {verifying ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
            Verify chain
          </Button>
        </PageActions>
      </PageHeader>
      <PageBody className="space-y-4">
        {verify && (
          <Card className={`p-3 flex items-center gap-3 ${verify.reachable && verify.ok ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20' : verify.reachable && !verify.ok ? 'border-rose-200 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20' : 'border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20'}`}>
            {verify.reachable ? (
              verify.ok ? <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> : <ShieldX className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : (
              <ShieldX className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">
                {!verify.reachable
                  ? 'Backend unreachable — chain is being recorded in local-fallback mode only.'
                  : verify.ok
                    ? `Chain intact · ${verify.verified} of ${verify.scanned} record${verify.scanned === 1 ? '' : 's'} verified`
                    : `Chain broken at record ${verify.brokenAt} · ${verify.verified} verified before break`}
              </p>
              {verify.head && <p className="text-[10px] text-muted-foreground font-mono truncate">head: {verify.head}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={runVerify} disabled={verifying} className="shrink-0">
              <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} />
            </Button>
          </Card>
        )}
        <Card className="p-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search user, entity, or change…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
                aria-label="Search audit logs by user, entity, or change"
              />
            </div>
            <Select value={action} onValueChange={setAction}><SelectTrigger className="w-full sm:w-40" aria-label="Filter by action type"><SelectValue /></SelectTrigger><SelectContent>{ACTION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
            <Select value={entity} onValueChange={setEntity}><SelectTrigger className="w-full sm:w-40" aria-label="Filter by entity type"><SelectValue /></SelectTrigger><SelectContent>{ENTITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
          </div>
        </Card>

        {logsQuery.isLoading ? <div className="space-y-2">{[0,1,2,3,4].map(i => <div key={i} className="h-16 rounded-md bg-muted/40 animate-pulse" />)}</div>
        : filtered.length === 0 ? <EmptyState icon={<ClipboardList className="h-6 w-6" />} title={logs.length === 0 ? 'No events yet' : 'No matches'} description={logs.length === 0 ? 'Actions will appear as you create, update, or delete records.' : 'Try a different filter.'} />
        : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {filtered.map(log => {
                const isOpen = !!expanded[log.id]
                const changes = parseChanges(log.changes)
                const user = log.userEmail || log.userId || 'system'
                return (
                  <li key={log.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <button
                      onClick={() => toggle(log.id)}
                      className="w-full flex items-start gap-3 text-left"
                      aria-expanded={isOpen}
                      aria-controls={`log-detail-${log.id}`}
                      aria-label={`${ACTION_LABEL[log.action] ?? log.action} ${ENTITY_LABEL[log.entityType] ?? log.entityType} by ${user} — ${formatRelativeTime(log.createdAt)}. ${isOpen ? 'Collapse' : 'Expand'} details.`}
                    >
                      <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0 ${log.action === 'create' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : log.action === 'update' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`} aria-hidden="true">
                        {log.action === 'create' ? <Plus className="h-3.5 w-3.5" /> : log.action === 'update' ? <Pencil className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${log.action === 'create' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : log.action === 'update' ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'}`}>{ACTION_LABEL[log.action] ?? log.action}</Badge>
                          <span className="text-sm font-medium">{ENTITY_LABEL[log.entityType] ?? log.entityType}</span>
                          {log.entityId && <span className="text-[10px] text-muted-foreground font-mono">{log.entityId.slice(0, 8)}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{user} · {formatRelativeTime(log.createdAt)}</p>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform mt-1 ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
                    </button>
                    {isOpen && (
                      <div id={`log-detail-${log.id}`} className="mt-3 ml-11 rounded-md border border-border bg-muted/30 p-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">User</span><span className="truncate">{user}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Timestamp</span><span>{new Date(log.createdAt).toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Entity</span><span>{log.entityType}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Entity ID</span><span className="font-mono">{log.entityId || '—'}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Action</span><span>{log.action}</span>
                        </div>
                        {Object.keys(changes).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Changes</p>
                            <pre className="text-[11px] font-mono bg-background rounded p-2 overflow-x-auto">{JSON.stringify(changes, null, 2)}</pre>
                          </div>
                        )}
                        {/* Future: show prev_hash + record_hash when immutable verification is activated */}
                        {log.prevHash && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Verification Chain</p>
                            <p className="text-[11px] font-mono text-muted-foreground truncate">prev: {log.prevHash} · hash: {log.recordHash}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </PageBody>
    </Page>
  )
}
