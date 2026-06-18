import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Page, PageHeader, PageTitle, PageBody, PageActions, Button, Card, Badge, EmptyState, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label, Switch, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@blinkdotnew/ui'
import { Plus, ShieldCheck, Trash2, Loader2, Pencil, Power, MapPin } from 'lucide-react'
import { blink } from '@/blink/client'
import { auditLog } from '@/lib/audit'
import { ruleFormSchema, getDefaultFormValues, buildRuleConfig, parseRuleConfigForForm, getTypeBadgeClass, RULE_TYPES, DAYS, type RuleFormValues } from '@/lib/rules-helpers'
import type { ParkingRule, ParkingSpot } from '@/types/park-it'

export const Route = createFileRoute('/rules')({
  head: () => ({ meta: [{ title: 'Rules · Park-It' }] }),
  component: RulesPage,
})

function RulesPage() {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<ParkingRule | null>(null)
  const [deleting, setDeleting] = useState<ParkingRule | null>(null)

  const rulesQuery = useQuery({
    queryKey: ['parking_rules'],
    queryFn: async () => { const l = await blink.db.table<ParkingRule>('parking_rules').list({ orderBy: { priority: 'asc' } }); return Array.isArray(l) ? l : [] },
  })
  const spotsQuery = useQuery({
    queryKey: ['parking_spots'],
    queryFn: async () => { const l = await blink.db.table<ParkingSpot>('parking_spots').list(); return Array.isArray(l) ? l : [] },
  })
  const rules = rulesQuery.data ?? []
  const spots = spotsQuery.data ?? []
  const spotMap = useMemo(() => Object.fromEntries(spots.map((s) => [s.id, s])), [spots])

  const toggleMut = useMutation({
    mutationFn: (r: ParkingRule) => blink.db.table<ParkingRule>('parking_rules').update(r.id, { isActive: Number(r.isActive) > 0 ? 0 : 1, updatedAt: new Date().toISOString() } as Partial<ParkingRule>),
    onSuccess: (_d, r) => {
      queryClient.invalidateQueries({ queryKey: ['parking_rules'] })
      auditLog({ action: 'update', entityType: 'parking_rule', entityId: r.id, changes: { isActive: !Number(r.isActive) } })
    },
  })

  const del = useMutation({
    mutationFn: (id: string) => blink.db.table<ParkingRule>('parking_rules').delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['parking_rules'] })
      auditLog({ action: 'delete', entityType: 'parking_rule', entityId: id, changes: { deleted: true } })
      toast.success('Rule deleted')
      setDeleting(null)
    },
    onError: () => toast.error('Failed to delete rule'),
  })

  return (
    <Page>
      <PageHeader>
        <div>
          <PageTitle>Parking Rules</PageTitle>
          <p className="text-xs text-muted-foreground">Attached to spots · evaluated when a session is scanned</p>
        </div>
        <PageActions>
          <Button asChild variant="outline" size="sm"><Link to="/spots"><MapPin className="h-4 w-4 mr-1.5" />Manage spots</Link></Button>
          <Button onClick={() => setAddOpen(true)} disabled={spots.length === 0}>
            <Plus className="h-4 w-4 mr-1.5" />Add Rule
          </Button>
        </PageActions>
      </PageHeader>

      <PageBody className="space-y-3">
        {spots.length === 0 && (
          <Card className="p-5 border-dashed border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
            <p className="text-sm">Create at least one <Link to="/spots" className="text-accent underline">parking spot</Link> before adding rules.</p>
          </Card>
        )}

        {rulesQuery.isLoading ? (
          <div className="space-y-2">{[0,1,2].map((i) => <div key={i} className="h-16 rounded-md bg-muted/40 animate-pulse" />)}</div>
        ) : rules.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="No rules yet" description="Rules are evaluated when a permit is scanned. Start with a time restriction on your busiest spot." />
        ) : (
          <div className="space-y-2">
            {rules.map((r) => {
              const spot = spotMap[r.spotId]
              return (
                <Card key={r.id} className="p-4 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{r.name}</p>
                      <Badge variant="outline" className={getTypeBadgeClass(r.ruleType)}>{r.ruleType.replace('_', ' ')}</Badge>
                      <Badge variant="outline" className="border-border text-muted-foreground">{spot?.name ?? '—'}</Badge>
                      {!Number(r.isActive) && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Priority {r.priority}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggleMut.mutate(r)} className="h-8 w-8 p-0" title={Number(r.isActive) > 0 ? 'Disable' : 'Enable'}>
                    <Power className={Number(r.isActive) > 0 ? 'h-4 w-4 text-emerald-500' : 'h-4 w-4 text-muted-foreground'} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(r)} className="h-8 w-8 p-0"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} className="h-8 w-8 p-0 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </Card>
              )
            })}
          </div>
        )}
      </PageBody>

      <RuleFormDialog open={addOpen} onOpenChange={setAddOpen} rule={null} spots={spots} onSaved={() => setAddOpen(false)} queryClient={queryClient} />
      <RuleFormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} rule={editing} spots={spots} onSaved={() => setEditing(null)} queryClient={queryClient} />
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Delete Rule</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete <strong>{deleting?.name}</strong>? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={del.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleting && del.mutate(deleting.id)} disabled={del.isPending}>
              {del.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

function RuleFormDialog({ open, onOpenChange, rule, spots, onSaved, queryClient }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  rule: ParkingRule | null
  spots: ParkingSpot[]
  onSaved: () => void
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const isEdit = !!rule
  const [form, setForm] = useState<RuleFormValues>(() => getDefaultFormValues(rule ? parseRuleConfigForForm(rule) : undefined))
  const [errors, setErrors] = useState<Partial<Record<keyof RuleFormValues, string>>>({})

  const ruleType = form.ruleType

  const validate = () => {
    const parsed = ruleFormSchema.safeParse(form)
    if (parsed.success) { setErrors({}); return true }
    const e: typeof errors = {}
    for (const issue of parsed.error.issues) e[issue.path[0] as keyof RuleFormValues] = issue.message
    setErrors(e)
    return false
  }

  const createMut = useMutation({
    mutationFn: (d: RuleFormValues) => blink.db.table<ParkingRule>('parking_rules').create({
      spotId: d.spotId, name: d.name, ruleType: d.ruleType,
      ruleConfig: JSON.stringify(buildRuleConfig(d)),
      priority: d.priority, isActive: d.isActive ? 1 : 0, createdBy: '',
    } as ParkingRule),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['parking_rules'] })
      auditLog({ action: 'create', entityType: 'parking_rule', entityId: r.id, changes: { name: r.name, type: r.ruleType } })
      toast.success('Rule created'); onSaved()
    },
    onError: () => toast.error('Failed to create rule'),
  })

  const updateMut = useMutation({
    mutationFn: (d: RuleFormValues) => blink.db.table<ParkingRule>('parking_rules').update(rule!.id, {
      spotId: d.spotId, name: d.name, ruleType: d.ruleType,
      ruleConfig: JSON.stringify(buildRuleConfig(d)),
      priority: d.priority, isActive: d.isActive ? 1 : 0, updatedAt: new Date().toISOString(),
    } as Partial<ParkingRule>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parking_rules'] })
      auditLog({ action: 'update', entityType: 'parking_rule', entityId: rule!.id, changes: { name: form.name } })
      toast.success('Rule updated'); onSaved()
    },
    onError: () => toast.error('Failed to update rule'),
  })

  const isPending = createMut.isPending || updateMut.isPending
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    isEdit ? updateMut.mutate(form) : createMut.mutate(form)
  }

  const uf = <K extends keyof RuleFormValues>(k: K, v: RuleFormValues[K]) => {
    setForm((p) => ({ ...p, [k]: v }))
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }))
  }
  const toggleDay = (d: number) => {
    const cur = form.allowedDays ?? []
    uf('allowedDays', cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Rule' : 'Add Rule'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Name <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. Business hours only" value={form.name} onChange={(e) => uf('name', e.target.value)} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Spot <span className="text-destructive">*</span></Label>
              <Select value={form.spotId} onValueChange={(v) => uf('spotId', v)}>
                <SelectTrigger><SelectValue placeholder="Select spot" /></SelectTrigger>
                <SelectContent>{spots.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              {errors.spotId && <p className="text-xs text-destructive">{errors.spotId}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Type</Label>
              <Select value={form.ruleType} onValueChange={(v) => uf('ruleType', v as RuleFormValues['ruleType'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RULE_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Priority</Label>
            <Input type="number" min="0" value={form.priority} onChange={(e) => uf('priority', Number(e.target.value) as any)} />
            <p className="text-[11px] text-muted-foreground">Higher priority rules are evaluated first.</p>
          </div>

          {ruleType === 'time_restriction' && (
            <div className="rounded-md border border-border p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Time restriction</p>
              <div className="space-y-1.5">
                <Label className="text-sm">Allowed days</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d) => (
                    <label key={d.value} className="inline-flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-input"
                        checked={form.allowedDays?.includes(d.value) ?? false}
                        onChange={() => toggleDay(d.value)}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">Leave empty to allow all days.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-sm">From</Label><Input type="time" value={form.startTime} onChange={(e) => uf('startTime', e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-sm">To</Label><Input type="time" value={form.endTime} onChange={(e) => uf('endTime', e.target.value)} /></div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Max duration (minutes, optional)</Label>
                <Input type="number" min="1" placeholder="e.g. 240" value={form.maxDurationMinutes ?? ''} onChange={(e) => uf('maxDurationMinutes', (e.target.value ? Number(e.target.value) : undefined) as any)} />
              </div>
            </div>
          )}

          {ruleType === 'permit_required' && (
            <div className="rounded-md border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Permit</p>
              <div className="space-y-1.5">
                <Label className="text-sm">Permit types (comma-separated, empty = any)</Label>
                <Input placeholder="RES, VIS, STF" value={form.permitTypesStr} onChange={(e) => uf('permitTypesStr', e.target.value)} className="font-mono" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={form.requireValidExpiry} onCheckedChange={(v) => uf('requireValidExpiry', v)} />
                <span className="text-sm">Require non-expired permit</span>
              </label>
            </div>
          )}

          {ruleType === 'vehicle_type' && (
            <div className="rounded-md border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vehicle type</p>
              <div className="space-y-1.5">
                <Label className="text-sm">Allowed types (comma-separated)</Label>
                <Input placeholder="car, suv, van" value={form.allowedTypesStr} onChange={(e) => uf('allowedTypesStr', e.target.value)} className="font-mono" />
              </div>
            </div>
          )}

          {ruleType === 'duration_limit' && (
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Duration limits use the <code>maxDurationMinutes</code> field on the time-restriction config. Switch the type to <strong>time_restriction</strong> to edit.</p>
            </div>
          )}

          {ruleType === 'custom' && (
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Custom rules pass by default. Extend <code>rule-engine.ts</code> to add logic.</p>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={form.isActive} onCheckedChange={(v) => uf('isActive', v)} />
            <span className="text-sm">Active</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
