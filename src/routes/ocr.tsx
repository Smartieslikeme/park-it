import { useState, useRef, useCallback, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Page, PageHeader, PageTitle, PageBody, PageActions, Button, Card, Input, Label, Badge, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, toast, Tabs, TabsList, TabsTrigger, TabsContent,
} from '@blinkdotnew/ui'
import { ScanLine, Upload, Loader2, CheckCircle2, XCircle, AlertTriangle, Save, RotateCcw, ImageIcon } from 'lucide-react'
import { blink } from '@/blink/client'
import { auditLog } from '@/lib/audit'
import { evaluateParkingRules } from '@/lib/rule-engine'
import type { OcrExtraction, ParkingRule, ParkingSession, RuleEvaluationResult, ParkingSpot, Vehicle } from '@/types/park-it'

export const Route = createFileRoute('/ocr')({
  head: () => ({ meta: [{ title: 'OCR Scanner · Park-It' }] }),
  component: OcrPage,
})

/**
 * System prompt for the AI vision model. We use generateObject so the
 * response is structured JSON matching our OcrExtraction schema. The model
 * is told to be precise: if a field is illegible, return empty string.
 */
const SYSTEM_PROMPT = `You are an expert parking permit OCR analyst for Park-It. Extract structured fields from the permit image. Be precise: if a field is illegible, return an empty string. Return JSON matching the schema exactly.`

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    plateNumber: { type: 'string' },
    permitNumber: { type: 'string' },
    permitExpiry: { type: 'string', description: 'YYYY-MM-DD' },
    ownerName: { type: 'string' },
    vehicleMake: { type: 'string' },
    vehicleModel: { type: 'string' },
    vehicleColor: { type: 'string' },
    vehicleType: { type: 'string' },
    permitType: { type: 'string' },
    confidence: { type: 'number', description: '0..1 overall confidence' },
    notes: { type: 'string' },
  },
  required: ['plateNumber', 'confidence'],
} as const

type Step = 'upload' | 'analyzing' | 'review' | 'saving' | 'done'
interface ScanState {
  fileName: string
  extraction: OcrExtraction | null
  evaluation: RuleEvaluationResult | null
  spotId: string
  vehicleId: string | null
  plateNumber: string
  overrides: Partial<OcrExtraction>
  step: Step
}
const INIT: ScanState = {
  fileName: '', extraction: null, evaluation: null,
  spotId: '', vehicleId: null, plateNumber: '', overrides: {},
  step: 'upload',
}

function OcrPage() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ScanState>(INIT)
  const [isDragging, setIsDragging] = useState(false)
  const [recent, setRecent] = useState<Array<{ id: string; name: string; allowed: boolean; at: string }>>([])

  const spotsQuery = useQuery({
    queryKey: ['parking_spots'],
    queryFn: async () => { const l = await blink.db.table<ParkingSpot>('parking_spots').list(); return Array.isArray(l) ? l : [] },
  })
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => { const l = await blink.db.table<Vehicle>('vehicles').list(); return Array.isArray(l) ? l : [] },
  })
  const rulesQuery = useQuery({
    queryKey: ['parking_rules', 'active'],
    queryFn: async () => {
      const l = await blink.db.table<ParkingRule>('parking_rules').list()
      return Array.isArray(l) ? l.filter((r) => Number(r.isActive) > 0) : []
    },
  })
  const spots = spotsQuery.data ?? []
  const vehicles = vehiclesQuery.data ?? []
  const activeRules: ParkingRule[] = useMemo(
    () => (rulesQuery.data ?? []).filter((r) => spots.some((s) => s.id === r.spotId)),
    [rulesQuery.data, spots]
  )

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image too large (max 10MB)'); return }
    setState({ ...INIT, step: 'analyzing', fileName: file.name })
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `ocr-permits/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { publicUrl } = await blink.storage.upload(file, path)
      const { object } = await blink.ai.generateObject({
        prompt: `${SYSTEM_PROMPT}\n\nImage URL: ${publicUrl}`,
        schema: EXTRACTION_SCHEMA,
      } as unknown as Parameters<typeof blink.ai.generateObject>[0])
      const extraction = object as OcrExtraction
      // Delete the image immediately — keep only the structured extraction.
      // This is a privacy + storage choice. The OCR result lives in the
      // session's `ocr_result` JSON column forever; the photo does not.
      try { await blink.storage.remove(path) } catch { /* best-effort */ }
      const evaluation = evaluateParkingRules(activeRules, {
        plateNumber: extraction.plateNumber,
        vehicleType: extraction.vehicleType,
        permitNumber: extraction.permitNumber,
        permitExpiry: extraction.permitExpiry,
      })
      setState((s) => ({
        ...s,
        extraction,
        evaluation,
        plateNumber: extraction.plateNumber,
        step: 'review',
      }))
      toast.success('Permit analyzed', { description: `Confidence: ${Math.round((extraction.confidence ?? 0) * 100)}%` })
    } catch (err) {
      console.error('[OCR] Failed:', err)
      toast.error('Analysis failed', { description: err instanceof Error ? err.message : 'Please try again' })
      setState(INIT)
    }
  }, [activeRules])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }, [handleFile])

  // Live overrides applied to the extraction so the user can correct OCR
  // mistakes before confirming the session.
  const live: OcrExtraction | null = useMemo(() => {
    if (!state.extraction) return null
    return { ...state.extraction, ...state.overrides }
  }, [state.extraction, state.overrides])

  // Re-evaluate rules whenever the user edits the extraction fields.
  const liveEval: RuleEvaluationResult | null = useMemo(() => {
    if (!live) return null
    return evaluateParkingRules(activeRules, {
      plateNumber: live.plateNumber,
      vehicleType: live.vehicleType,
      permitNumber: live.permitNumber,
      permitExpiry: live.permitExpiry,
    })
  }, [live, activeRules])

  const confirmMut = useMutation({
    mutationFn: async () => {
      if (!live || !liveEval) throw new Error('No extraction')
      if (!state.spotId) throw new Error('Pick a spot first')
      let vehicleId: string | null = state.vehicleId
      if (!vehicleId && live.plateNumber) {
        const match = vehicles.find((v) => v.plateNumber === live.plateNumber)
        if (match) vehicleId = match.id
        else {
          const created = await blink.db.table<Vehicle>('vehicles').create({
            plateNumber: live.plateNumber, make: live.vehicleMake || '',
            model: live.vehicleModel || '', color: live.vehicleColor || '',
            vehicleType: live.vehicleType || 'car', ownerName: live.ownerName || '',
            permitNumber: live.permitNumber || '', permitExpiry: live.permitExpiry || '',
            isRegistered: live.permitNumber ? 1 : 0, createdBy: '',
          } as Vehicle)
          vehicleId = created.id
        }
      }
      return blink.db.table<ParkingSession>('parking_sessions').create({
        spotId: state.spotId, vehicleId, plateNumber: live.plateNumber,
        startTime: new Date().toISOString(), endTime: null,
        status: liveEval.allowed ? 'active' : 'violation',
        validatedByOcr: 1, ocrImageUrl: '', ocrResult: JSON.stringify({ extraction: live, evaluation: liveEval }),
        notes: live.notes || '', createdBy: '',
      } as ParkingSession)
    },
    onSuccess: async (s) => {
      await auditLog({
        action: 'create', entityType: 'parking_session', entityId: s.id,
        changes: { plateNumber: s.plateNumber, status: s.status, validatedByOcr: true },
      })
      queryClient.invalidateQueries({ queryKey: ['parking_sessions'] })
      queryClient.invalidateQueries({ queryKey: ['parking_spots'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      setState((s) => ({ ...s, step: 'done' }))
      setRecent((p) => [
        { id: s.id, name: s.plateNumber || '(unknown)', allowed: s.status === 'active', at: s.startTime },
        ...p,
      ].slice(0, 5))
      if (s.status === 'violation') {
        toast.error('Session created — rule violation', { description: liveEval?.reason ?? '' })
      } else {
        toast.success('Session created', { description: `${s.plateNumber} is parked` })
      }
    },
    onError: (err: Error) => {
      toast.error('Failed to create session', { description: err.message })
      setState((s) => ({ ...s, step: 'review' }))
    },
  })

  return (
    <Page>
      <PageHeader>
        <div>
          <PageTitle>OCR Scanner</PageTitle>
          <p className="text-xs text-muted-foreground">Upload a permit photo → AI extracts → rules evaluate → session created</p>
        </div>
        <PageActions>
          {state.step !== 'upload' && (
            <Button variant="outline" size="sm" onClick={() => setState(INIT)}>
              <RotateCcw className="h-4 w-4 mr-1.5" />New scan
            </Button>
          )}
        </PageActions>
      </PageHeader>

      <PageBody>
        <Tabs defaultValue="scanner" className="space-y-5">
          <TabsList>
            <TabsTrigger value="scanner"><ScanLine className="h-3.5 w-3.5 mr-1.5" />Scanner</TabsTrigger>
            <TabsTrigger value="recent">Recent ({recent.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="scanner" className="space-y-5 mt-0">
            {state.step === 'upload' && (
              <>
                {spots.length === 0 ? (
                  <Card className="p-6 border-dashed border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10" role="alert">
                    <p className="text-sm">You need to <Link to="/spots" className="text-accent underline">add a parking spot</Link> before you can scan permits.</p>
                  </Card>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Upload permit image — drag and drop or click to choose a file"
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
                    className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${isDragging ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/40 hover:bg-muted/30'}`}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      aria-hidden="true"
                      tabIndex={-1}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
                    />
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                      <Upload className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">Drop a permit image here</p>
                      <p className="text-xs text-muted-foreground mt-1">Image is deleted after analysis · JPG, PNG or WebP · up to 10 MB</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-xs" aria-hidden="true">
                      <ImageIcon className="h-4 w-4" />Choose file
                    </span>
                  </div>
                )}
                {activeRules.length > 0 && (
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">
                      <strong>{activeRules.length}</strong> active rule{activeRules.length === 1 ? '' : 's'} will be checked when you confirm.
                    </p>
                  </Card>
                )}
              </>
            )}

            {state.step === 'analyzing' && (
              <Card className="p-8" role="status" aria-live="polite" aria-label="Analyzing permit image, please wait">
                <div className="flex flex-col items-center gap-3 max-w-md mx-auto text-center">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent" aria-hidden="true">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </span>
                  <p className="text-sm font-semibold">Analyzing permit…</p>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">{state.fileName}</p>
                </div>
              </Card>
            )}

            {(state.step === 'review' || state.step === 'saving' || state.step === 'done') && live && liveEval && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Result banner */}
                <Card
                  className={`p-4 ${liveEval.allowed ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20' : 'border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20'}`}
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-3">
                    {liveEval.allowed
                      ? <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0" aria-hidden="true"><CheckCircle2 className="h-5 w-5" /></span>
                      : <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 shrink-0" aria-hidden="true"><XCircle className="h-5 w-5" /></span>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{liveEval.allowed ? 'Rules passed' : 'Rule violation'}</p>
                      <p className="text-xs text-muted-foreground">{liveEval.reason}</p>
                      {liveEval.matchedRuleName && (
                        <Badge variant="outline" className="mt-1.5 text-[10px]">{liveEval.matchedRuleName}</Badge>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Spot / vehicle picker */}
                <Card className="p-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ocr-spot" className="text-xs">Assign to spot <span className="text-destructive" aria-hidden="true">*</span><span className="sr-only">(required)</span></Label>
                    <Select value={state.spotId} onValueChange={(v) => setState((s) => ({ ...s, spotId: v }))}>
                      <SelectTrigger id="ocr-spot"><SelectValue placeholder="Select spot" /></SelectTrigger>
                      <SelectContent>{spots.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.status})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ocr-vehicle" className="text-xs">Or pick existing vehicle</Label>
                    <Select value={state.vehicleId ?? '__new'} onValueChange={(v) => setState((s) => ({ ...s, vehicleId: v === '__new' ? null : v, plateNumber: v === '__new' ? s.plateNumber : (vehicles.find((vv) => vv.id === v)?.plateNumber ?? '') }))}>
                      <SelectTrigger id="ocr-vehicle"><SelectValue placeholder="Create new from OCR" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new">— Create new from OCR data —</SelectItem>
                        {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.plateNumber}{v.ownerName ? ` (${v.ownerName})` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </Card>

                {/* Extracted fields (editable) */}
                <Card className="p-4 lg:col-span-2 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Extracted data — you can edit before confirming</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="License plate" value={live.plateNumber} onChange={(v) => setState((s) => ({ ...s, overrides: { ...s.overrides, plateNumber: v.toUpperCase() }, plateNumber: v.toUpperCase() }))} mono />
                    <Field label="Permit number" value={live.permitNumber} onChange={(v) => setState((s) => ({ ...s, overrides: { ...s.overrides, permitNumber: v } }))} mono />
                    <Field label="Permit expiry" value={live.permitExpiry} onChange={(v) => setState((s) => ({ ...s, overrides: { ...s.overrides, permitExpiry: v } }))} placeholder="YYYY-MM-DD" />
                    <Field label="Owner name" value={live.ownerName} onChange={(v) => setState((s) => ({ ...s, overrides: { ...s.overrides, ownerName: v } }))} />
                    <Field label="Vehicle make" value={live.vehicleMake} onChange={(v) => setState((s) => ({ ...s, overrides: { ...s.overrides, vehicleMake: v } }))} />
                    <Field label="Vehicle model" value={live.vehicleModel} onChange={(v) => setState((s) => ({ ...s, overrides: { ...s.overrides, vehicleModel: v } }))} />
                    <Field label="Vehicle color" value={live.vehicleColor} onChange={(v) => setState((s) => ({ ...s, overrides: { ...s.overrides, vehicleColor: v } }))} />
                    <Field label="Vehicle type" value={live.vehicleType} onChange={(v) => setState((s) => ({ ...s, overrides: { ...s.overrides, vehicleType: v } }))} />
                  </div>
                </Card>

                {/* Confirm */}
                <Card className="p-4 lg:col-span-2">
                  {state.step !== 'done' ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                        {liveEval.allowed ? 'Session will be created as active.' : 'Session will be flagged as a violation.'}
                      </p>
                      <Button
                        onClick={() => { setState((s) => ({ ...s, step: 'saving' })); confirmMut.mutate() }}
                        disabled={state.step === 'saving' || !state.spotId}
                        aria-label={!state.spotId ? 'Select a spot first to confirm' : state.step === 'saving' ? 'Creating session…' : 'Confirm and create parking session'}
                      >
                        <Save className="h-4 w-4 mr-1.5" aria-hidden="true" />{state.step === 'saving' ? 'Creating…' : 'Confirm session'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2" role="status" aria-live="polite">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                      <p className="text-sm font-medium">Session created. {state.plateNumber || '(unknown)'} is now parked in {spots.find((s) => s.id === state.spotId)?.name}.</p>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recent" className="mt-0">
            <Card>
              {recent.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No scans yet.</div>
              ) : (
                <ul className="divide-y divide-border" aria-label="Recent permit scans">
                  {recent.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 p-4">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${r.allowed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`} aria-hidden="true">
                        {r.allowed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium font-mono truncate">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(r.at).toLocaleString()}</p>
                      </div>
                      <Badge variant={r.allowed ? 'secondary' : 'destructive'}>{r.allowed ? 'Active' : 'Violation'}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </PageBody>
    </Page>
  )
}

function Field({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  const id = `ocr-field-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={mono ? 'font-mono text-sm' : 'text-sm'} />
    </div>
  )
}
