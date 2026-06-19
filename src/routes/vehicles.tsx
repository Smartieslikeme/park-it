import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Page, PageHeader, PageTitle, PageBody, PageActions, Button, DataTable, Badge, EmptyState, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Label, Switch,
} from '@blinkdotnew/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Car, Pencil, Trash2, Loader2, Search, ShieldCheck, ShieldX } from 'lucide-react'
import { blink } from '@/blink/client'
import { auditLog } from '@/lib/audit'
import { encryptRecord, decryptRecord, ENCRYPTED_FIELDS } from '@/lib/crypto'
import type { Vehicle } from '@/types/park-it'
import { isPermitValid, vehicleTypeLabel, EMPTY_VEHICLE_FORM, toFormState, type VehicleFormState } from '@/lib/vehicles-helpers'

export const Route = createFileRoute('/vehicles')({
  head: () => ({ meta: [{ title: 'Vehicles · Park-It' }, { name: 'description', content: 'Vehicle registry with encrypted plate, owner, and permit data.' }] }),
  component: VehiclesPage,
})

function VehiclesPage() {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [deleting, setDeleting] = useState<Vehicle | null>(null)
  const [search, setSearch] = useState('')

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const list = await blink.db.table<Vehicle>('vehicles').list({ orderBy: { createdAt: 'desc' } })
      const arr = Array.isArray(list) ? list : []
      // Decrypt sensitive fields for display
      return Promise.all(arr.map(v => decryptRecord(v, [...ENCRYPTED_FIELDS.vehicles])))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => blink.db.table<Vehicle>('vehicles').delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['audit_logs'] })
      auditLog({ action: 'delete', entityType: 'vehicle', entityId: id, changes: { deleted: true } })
      toast.success('Vehicle removed'); setDeleting(null)
    },
    onError: () => toast.error('Failed to delete vehicle'),
  })

  const filtered = useMemo(() => {
    const list = vehicles ?? []
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter(v =>
      v.plateNumber?.toLowerCase().includes(q) || v.make?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q) || v.ownerName?.toLowerCase().includes(q) || v.permitNumber?.toLowerCase().includes(q))
  }, [vehicles, search])

  const columns: ColumnDef<Vehicle>[] = useMemo(() => [
    { accessorKey: 'plateNumber', header: 'Plate', cell: ({ row }) => <span className="font-mono font-medium text-sm">{row.original.plateNumber}</span> },
    { id: 'vehicle', header: 'Vehicle', cell: ({ row }) => { const v = row.original; const parts = [v.color, v.make, v.model].filter(Boolean).join(' '); return <div className="min-w-0"><p className="text-sm font-medium truncate">{parts || '—'}</p><p className="text-[11px] text-muted-foreground">{vehicleTypeLabel(v.vehicleType)}</p></div> } },
    { accessorKey: 'ownerName', header: 'Owner', cell: ({ row }) => { const v = row.original; return <div className="min-w-0"><p className="text-sm truncate">{v.ownerName || '—'}</p>{v.ownerPhone && <p className="text-[11px] text-muted-foreground">{v.ownerPhone}</p>}</div> } },
    { id: 'permit', header: 'Permit', cell: ({ row }) => { const v = row.original; if (!v.permitNumber) return <span className="text-xs text-muted-foreground">No permit</span>; const valid = isPermitValid(v); return <div className="min-w-0"><p className="text-sm font-mono truncate">{v.permitNumber}</p><p className={`text-[11px] inline-flex items-center gap-1 ${valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{valid ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}Exp {v.permitExpiry ? new Date(v.permitExpiry).toLocaleDateString() : '—'}</p></div> } },
    { accessorKey: 'isRegistered', header: 'Status', cell: ({ row }) => Number(row.original.isRegistered) > 0 ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">Registered</Badge> : <Badge variant="secondary">Unregistered</Badge> },
    { id: 'actions', header: 'Actions', cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)} className="h-8 w-8 p-0"><Pencil className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleting(row.original)} className="h-8 w-8 p-0 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button>
      </div>
    ) },
  ], [])

  return (
    <Page>
      <PageHeader>
        <div><PageTitle>Vehicles</PageTitle><p className="text-xs text-muted-foreground">Encrypted vehicle registry with permit tracking.</p></div>
        <PageActions>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search plate, owner, permit…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 w-64"
              aria-label="Search vehicles by plate, owner, or permit number"
            />
          </div>
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />Register Vehicle</Button>
        </PageActions>
      </PageHeader>
      <PageBody>
        {isLoading ? <div className="space-y-2">{[0,1,2,3].map(i => <div key={i} className="h-14 rounded-md bg-muted/40 animate-pulse" />)}</div>
        : filtered.length === 0 ? <EmptyState icon={<Car className="h-6 w-6" />} title={search ? 'No matches' : 'No vehicles registered'} description={search ? 'Try a different search.' : 'Register a vehicle to start tracking.'} />
        : <DataTable columns={columns} data={filtered} />}
      </PageBody>
      <VehicleFormDialog open={addOpen} onOpenChange={setAddOpen} vehicle={null} onSaved={() => setAddOpen(false)} queryClient={queryClient} />
      <VehicleFormDialog open={!!editing} onOpenChange={o => !o && setEditing(null)} vehicle={editing} onSaved={() => setEditing(null)} queryClient={queryClient} />
      <Dialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Remove Vehicle</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to permanently remove <strong className="text-foreground font-mono">{deleting?.plateNumber}</strong>? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>Cancel — keep vehicle</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}>{deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}Yes, remove vehicle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

function VehicleFormDialog({ open, onOpenChange, vehicle, onSaved, queryClient }: { open: boolean; onOpenChange: (o: boolean) => void; vehicle: Vehicle | null; onSaved: () => void; queryClient: ReturnType<typeof useQueryClient> }) {
  const isEdit = !!vehicle
  const [form, setForm] = useState<VehicleFormState>(() => vehicle ? toFormState(vehicle) : { ...EMPTY_VEHICLE_FORM })
  const [errors, setErrors] = useState<Partial<Record<keyof VehicleFormState, string>>>({})

  const validate = () => { const e: typeof errors = {}; if (!form.plateNumber.trim()) e.plateNumber = 'Required'; setErrors(e); return Object.keys(e).length === 0 }

  const createMut = useMutation({
    mutationFn: async (d: VehicleFormState) => {
      const encrypted = await encryptRecord({ plateNumber: d.plateNumber.trim().toUpperCase(), ownerName: d.ownerName.trim(), ownerPhone: d.ownerPhone.trim() }, ['plateNumber', 'ownerName', 'ownerPhone'])
      return blink.db.table<Vehicle>('vehicles').create({ ...encrypted, make: d.make.trim(), model: d.model.trim(), color: d.color.trim(), vehicleType: d.vehicleType, permitNumber: d.permitNumber.trim(), permitExpiry: d.permitExpiry.trim(), isRegistered: d.isRegistered ? 1 : 0, createdBy: '' } as Vehicle)
    },
    onSuccess: (c) => { queryClient.invalidateQueries({ queryKey: ['vehicles'] }); auditLog({ action: 'create', entityType: 'vehicle', entityId: c.id, changes: { plateNumber: form.plateNumber.trim().toUpperCase() } }); toast.success('Vehicle registered'); onSaved() },
    onError: () => toast.error('Failed to register'),
  })

  const updateMut = useMutation({
    mutationFn: async (d: VehicleFormState) => {
      const encrypted = await encryptRecord({ plateNumber: d.plateNumber.trim().toUpperCase(), ownerName: d.ownerName.trim(), ownerPhone: d.ownerPhone.trim() }, ['plateNumber', 'ownerName', 'ownerPhone'])
      return blink.db.table<Vehicle>('vehicles').update(vehicle!.id, { ...encrypted, make: d.make.trim(), model: d.model.trim(), color: d.color.trim(), vehicleType: d.vehicleType, permitNumber: d.permitNumber.trim(), permitExpiry: d.permitExpiry.trim(), isRegistered: d.isRegistered ? 1 : 0, updatedAt: new Date().toISOString() } as Partial<Vehicle>)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vehicles'] }); auditLog({ action: 'update', entityType: 'vehicle', entityId: vehicle!.id, changes: { plateNumber: form.plateNumber.trim().toUpperCase() } }); toast.success('Vehicle updated'); onSaved() },
    onError: () => toast.error('Failed to update'),
  })

  const isPending = createMut.isPending || updateMut.isPending
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!validate()) return; isEdit ? updateMut.mutate(form) : createMut.mutate(form) }
  const uf = <K extends keyof VehicleFormState>(k: K, v: VehicleFormState[K]) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(p => ({ ...p, [k]: undefined })) }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Vehicle' : 'Register Vehicle'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-plate" className="text-sm font-medium">License Plate <span className="text-destructive" aria-hidden="true">*</span><span className="sr-only">(required)</span></Label>
            <Input id="vehicle-plate" placeholder="ABC-1234" value={form.plateNumber} onChange={e => uf('plateNumber', e.target.value.toUpperCase())} className="font-mono" aria-invalid={!!errors.plateNumber} aria-describedby={errors.plateNumber ? 'vehicle-plate-error' : undefined} />
            {errors.plateNumber && <p id="vehicle-plate-error" className="text-xs text-destructive" role="alert">{errors.plateNumber}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vehicle-type" className="text-sm font-medium">Vehicle Type</Label>
              <Select value={form.vehicleType} onValueChange={v => uf('vehicleType', v)}>
                <SelectTrigger id="vehicle-type"><SelectValue /></SelectTrigger>
                <SelectContent>{['car','motorcycle','suv','truck','van','other'].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="vehicle-color" className="text-sm font-medium">Color</Label><Input id="vehicle-color" placeholder="Silver" value={form.color} onChange={e => uf('color', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="vehicle-make" className="text-sm font-medium">Make</Label><Input id="vehicle-make" placeholder="Tesla" value={form.make} onChange={e => uf('make', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="vehicle-model" className="text-sm font-medium">Model</Label><Input id="vehicle-model" placeholder="Model 3" value={form.model} onChange={e => uf('model', e.target.value)} /></div>
          </div>
          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Owner <span className="normal-case">(encrypted at rest)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="vehicle-owner-name" className="text-sm font-medium">Name</Label><Input id="vehicle-owner-name" placeholder="John Doe" value={form.ownerName} onChange={e => uf('ownerName', e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="vehicle-owner-phone" className="text-sm font-medium">Phone</Label><Input id="vehicle-owner-phone" placeholder="+1 555-1234" value={form.ownerPhone} onChange={e => uf('ownerPhone', e.target.value)} /></div>
            </div>
          </div>
          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Permit</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="vehicle-permit-num" className="text-sm font-medium">Permit number</Label><Input id="vehicle-permit-num" placeholder="RES-2024-117" value={form.permitNumber} onChange={e => uf('permitNumber', e.target.value)} className="font-mono" /></div>
              <div className="space-y-1.5"><Label htmlFor="vehicle-permit-expiry" className="text-sm font-medium">Expiry date</Label><Input id="vehicle-permit-expiry" type="date" value={form.permitExpiry} onChange={e => uf('permitExpiry', e.target.value)} /></div>
            </div>
            <label htmlFor="vehicle-registered" className="flex items-center gap-2 cursor-pointer"><Switch id="vehicle-registered" checked={form.isRegistered} onCheckedChange={v => uf('isRegistered', v)} /><span className="text-sm">Mark as registered</span></label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}{isEdit ? 'Save Changes' : 'Register Vehicle'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
