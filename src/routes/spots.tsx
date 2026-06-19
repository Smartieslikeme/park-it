import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Page, PageHeader, PageTitle, PageBody, PageActions, Button, DataTable, Badge, EmptyState, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Label,
} from '@blinkdotnew/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, MapPin, Pencil, Trash2, Loader2 } from 'lucide-react'
import { blink } from '@/blink/client'
import { auditLog } from '@/lib/audit'
import type { ParkingSpot } from '@/types/park-it'
import { STATUS_CONFIG, TYPE_CONFIG, EMPTY_FORM, type SpotFormState } from '@/lib/spots-helpers'

export const Route = createFileRoute('/spots')({
  head: () => ({ meta: [{ title: 'Parking Spots · Park-It' }] }),
  component: SpotsPage,
})

function SpotsPage() {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<ParkingSpot | null>(null)
  const [deleting, setDeleting] = useState<ParkingSpot | null>(null)

  const { data: spots, isLoading } = useQuery({
    queryKey: ['parking_spots'],
    queryFn: async () => { const l = await blink.db.table<ParkingSpot>('parking_spots').list({ orderBy: { createdAt: 'desc' } }); return Array.isArray(l) ? l : [] },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => blink.db.table<ParkingSpot>('parking_spots').delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['parking_spots'] })
      auditLog({ action: 'delete', entityType: 'parking_spot', entityId: id, changes: { deleted: true } })
      toast.success('Spot deleted'); setDeleting(null)
    },
    onError: () => toast.error('Failed to delete spot'),
  })

  const dataRows = spots ?? []

  const columns: ColumnDef<ParkingSpot>[] = useMemo(() => [
    { accessorKey: 'name', header: 'Name', cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span> },
    { accessorKey: 'locationName', header: 'Location', cell: ({ getValue }) => (getValue() as string) || <span className="text-muted-foreground">—</span> },
    { id: 'floorSection', header: 'Floor / Section', cell: ({ row }) => { const { floor, section } = row.original; return (!floor && !section) ? <span className="text-muted-foreground">—</span> : <span className="text-sm">{floor || '—'} / {section || '—'}</span> } },
    { accessorKey: 'spotType', header: 'Type', cell: ({ getValue }) => { const v = getValue() as string; const cfg = TYPE_CONFIG[v] ?? TYPE_CONFIG.standard; return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge> } },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => { const v = getValue() as string; const cfg = STATUS_CONFIG[v] ?? STATUS_CONFIG.available; return <Badge variant={cfg.variant} className={cfg.className || undefined}>{cfg.label}</Badge> } },
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
        <PageTitle>Parking Spots</PageTitle>
        <PageActions><Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Add Spot</Button></PageActions>
      </PageHeader>
      <PageBody>
        {isLoading ? <div className="space-y-2" aria-label="Loading parking spots" role="status">{[0,1,2,3].map(i => <div key={i} className="h-14 rounded-md bg-muted/40 animate-pulse" aria-hidden="true" />)}</div>
        : dataRows.length === 0 ? <EmptyState icon={<MapPin className="h-6 w-6" aria-hidden="true" />} title="No spots yet" description="Add your first parking spot to get started." />
        : <DataTable columns={columns} data={dataRows} />}
      </PageBody>
      <SpotFormDialog open={addOpen} onOpenChange={setAddOpen} spot={null} onSaved={() => setAddOpen(false)} queryClient={queryClient} />
      <SpotFormDialog open={!!editing} onOpenChange={o => !o && setEditing(null)} spot={editing} onSaved={() => setEditing(null)} queryClient={queryClient} />
      <Dialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Delete Parking Spot</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to permanently delete <strong>{deleting?.name}</strong>? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>Cancel — keep spot</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}Yes, delete spot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

function SpotFormDialog({ open, onOpenChange, spot, onSaved, queryClient }: { open: boolean; onOpenChange: (o: boolean) => void; spot: ParkingSpot | null; onSaved: () => void; queryClient: ReturnType<typeof useQueryClient> }) {
  const isEdit = !!spot
  const [form, setForm] = useState<SpotFormState>(() => spot ? { name: spot.name, locationName: spot.locationName ?? '', lat: String(spot.lat ?? ''), lng: String(spot.lng ?? ''), floor: spot.floor ?? '', section: spot.section ?? '', spotType: spot.spotType, status: spot.status, notes: spot.notes ?? '' } : { ...EMPTY_FORM })
  const [errors, setErrors] = useState<Partial<Record<keyof SpotFormState, string>>>({})

  const validate = () => { const e: typeof errors = {}; if (!form.name.trim()) e.name = 'Name is required'; if (form.lat && isNaN(Number(form.lat))) e.lat = 'Must be a number'; if (form.lng && isNaN(Number(form.lng))) e.lng = 'Must be a number'; setErrors(e); return Object.keys(e).length === 0 }

  const createMut = useMutation({
    mutationFn: (d: SpotFormState) => blink.db.table<ParkingSpot>('parking_spots').create({ name: d.name.trim(), locationName: d.locationName.trim(), lat: d.lat ? Number(d.lat) : 0, lng: d.lng ? Number(d.lng) : 0, floor: d.floor.trim(), section: d.section.trim(), spotType: d.spotType, status: d.status, notes: d.notes.trim(), createdBy: '' } as ParkingSpot),
    onSuccess: (c) => { queryClient.invalidateQueries({ queryKey: ['parking_spots'] }); auditLog({ action: 'create', entityType: 'parking_spot', entityId: c.id, changes: { name: form.name.trim() } }); toast.success('Spot created'); onSaved() },
    onError: () => toast.error('Failed to create spot'),
  })

  const updateMut = useMutation({
    mutationFn: (d: SpotFormState) => blink.db.table<ParkingSpot>('parking_spots').update(spot!.id, { name: d.name.trim(), locationName: d.locationName.trim(), lat: d.lat ? Number(d.lat) : 0, lng: d.lng ? Number(d.lng) : 0, floor: d.floor.trim(), section: d.section.trim(), spotType: d.spotType, status: d.status, notes: d.notes.trim(), updatedAt: new Date().toISOString() } as Partial<ParkingSpot>),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['parking_spots'] }); auditLog({ action: 'update', entityType: 'parking_spot', entityId: spot!.id, changes: { name: form.name.trim() } }); toast.success('Spot updated'); onSaved() },
    onError: () => toast.error('Failed to update spot'),
  })

  const isPending = createMut.isPending || updateMut.isPending
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!validate()) return; isEdit ? updateMut.mutate(form) : createMut.mutate(form) }
  const uf = <K extends keyof SpotFormState>(key: K, val: SpotFormState[K]) => { setForm(p => ({ ...p, [key]: val })); if (errors[key]) setErrors(p => ({ ...p, [key]: undefined })) }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Parking Spot' : 'Add Parking Spot'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="spot-name" className="text-sm font-medium">Name <span className="text-destructive" aria-hidden="true">*</span><span className="sr-only">(required)</span></Label>
            <Input id="spot-name" placeholder="e.g. P1-A12" value={form.name} onChange={e => uf('name', e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'spot-name-error' : undefined} />
            {errors.name && <p id="spot-name-error" className="text-xs text-destructive" role="alert">{errors.name}</p>}
          </div>
          <div className="space-y-1.5"><Label htmlFor="spot-loc" className="text-sm font-medium">Location</Label><Input id="spot-loc" placeholder="e.g. Main Garage" value={form.locationName} onChange={e => uf('locationName', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="spot-lat" className="text-sm font-medium">Latitude</Label><Input id="spot-lat" placeholder="42.3601" value={form.lat} onChange={e => uf('lat', e.target.value)} aria-invalid={!!errors.lat} aria-describedby={errors.lat ? 'spot-lat-error' : undefined} />{errors.lat && <p id="spot-lat-error" className="text-xs text-destructive" role="alert">{errors.lat}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="spot-lng" className="text-sm font-medium">Longitude</Label><Input id="spot-lng" placeholder="-71.0589" value={form.lng} onChange={e => uf('lng', e.target.value)} aria-invalid={!!errors.lng} aria-describedby={errors.lng ? 'spot-lng-error' : undefined} />{errors.lng && <p id="spot-lng-error" className="text-xs text-destructive" role="alert">{errors.lng}</p>}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="spot-floor" className="text-sm font-medium">Floor</Label><Input id="spot-floor" placeholder="e.g. 1" value={form.floor} onChange={e => uf('floor', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="spot-section" className="text-sm font-medium">Section</Label><Input id="spot-section" placeholder="e.g. A" value={form.section} onChange={e => uf('section', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="spot-type" className="text-sm font-medium">Spot Type</Label>
              <Select value={form.spotType} onValueChange={v => uf('spotType', v as ParkingSpot['spotType'])}><SelectTrigger id="spot-type"><SelectValue /></SelectTrigger>
                <SelectContent>{['standard','handicap','electric','compact','motorcycle','reserved'].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="spot-status" className="text-sm font-medium">Status</Label>
              <Select value={form.status} onValueChange={v => uf('status', v as ParkingSpot['status'])}><SelectTrigger id="spot-status"><SelectValue /></SelectTrigger>
                <SelectContent>{['available','occupied','maintenance','reserved'].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="spot-notes" className="text-sm font-medium">Notes</Label><Input id="spot-notes" placeholder="Optional notes" value={form.notes} onChange={e => uf('notes', e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}{isEdit ? 'Save Changes' : 'Create Spot'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
