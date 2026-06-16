import { useState, useRef, useCallback, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Page, PageHeader, PageTitle, PageBody, PageActions, Button, Card, Input, Label, Badge, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, toast, Skeleton, Tabs, TabsList, TabsTrigger, TabsContent } from '@blinkdotnew/ui'
import { ScanLine, Upload, Loader2, CheckCircle2, XCircle, AlertTriangle, Camera, Sparkles, ArrowRight, RotateCcw, Save, ImageIcon } from 'lucide-react'
import { blink } from '@/blink/client'
import { auditLog } from '@/lib/audit'
import { evaluateParkingRules } from '@/lib/rule-engine'
import type { OcrExtraction, ParkingRule, ParkingSession, ParkingSpot, RuleEvaluationResult, Vehicle } from '@/types/park-it'
import { formatRelativeTime } from '@/lib/dashboard-helpers'

export const Route = createFileRoute('/ocr')({
  head: () => ({ meta: [{ title: 'OCR Scanner · Park-It' }, { name: 'description', content: 'Upload a permit image and let AI vision extract plate, permit number, owner, and expiry. Validates against active parking rules in real time.' }] }),
  component: OcrPage,
})

const EXTRACTION_SCHEMA = {
  type: 'object', properties: {
    plateNumber: { type: 'string' }, permitNumber: { type: 'string' }, permitExpiry: { type: 'string' },
    ownerName: { type: 'string' }, vehicleMake: { type: 'string' }, vehicleModel: { type: 'string' },
    vehicleColor: { type: 'string' }, vehicleType: { type: 'string', enum: ['car', 'motorcycle', 'suv', 'truck', 'van', 'other'] },
    permitType: { type: 'string' }, confidence: { type: 'number' }, notes: { type: 'string' },
  }, required: ['plateNumber', 'permitNumber', 'confidence'],
} as const

const SYSTEM_PROMPT = `You are an expert parking permit OCR analyst for Park-It, an enterprise parking management platform.
Extract structured information from the uploaded permit image. Be precise and conservative.
Only return what you can clearly read. Use empty strings for missing fields. Return JSON matching the schema exactly.`

type Step = 'upload' | 'analyzing' | 'review' | 'saving' | 'done'
interface ScanState { imageUrl: string; fileName: string; extraction: OcrExtraction | null; evaluation: RuleEvaluationResult | null; matchedSpotId: string; overrides: Partial<OcrExtraction>; step: Step }
const INIT: ScanState = { imageUrl: '', fileName: '', extraction: null, evaluation: null, matchedSpotId: '', overrides: {}, step: 'upload' }

function OcrPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ScanState>(INIT)
  const [isDragging, setIsDragging] = useState(false)
  const [recentScans, setRecentScans] = useState<Array<{ id: string; plate: string; confidence: number; allowed: boolean; at: string }>>([])

  const rulesQuery = useQuery({ queryKey: ['parking_rules', 'active'], queryFn: async () => { const l = await blink.db.table<ParkingRule>('parking_rules').list(); return Array.isArray(l) ? l.filter(r => Number(r.isActive) > 0) : [] } })
  const spotsQuery = useQuery({ queryKey: ['parking_spots'], queryFn: async () => { const l = await blink.db.table<ParkingSpot>('parking_spots').list(); return Array.isArray(l) ? l : [] } })
  const activeRules = rulesQuery.data ?? []
  const spots = spotsQuery.data ?? []

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image too large', { description: 'Maximum 10MB' }); return }
    setState({ ...INIT, step: 'analyzing', fileName: file.name })
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `ocr-permits/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { publicUrl } = await blink.storage.upload(file, path)
      setState(s => ({ ...s, imageUrl: publicUrl }))
      const { object } = await blink.ai.generateObject({ prompt: `${SYSTEM_PROMPT}\n\nImage URL: ${publicUrl}`, schema: EXTRACTION_SCHEMA } as unknown as Parameters<typeof blink.ai.generateObject>[0])
      const extraction = object as OcrExtraction
      const evaluation = evaluateParkingRules(activeRules, { plateNumber: extraction.plateNumber, vehicleType: extraction.vehicleType, permitNumber: extraction.permitNumber, permitExpiry: extraction.permitExpiry })
      setState(s => ({ ...s, extraction, evaluation, step: 'review' }))
      setRecentScans(p => [{ id: `scan-${Date.now()}`, plate: extraction.plateNumber || '—', confidence: extraction.confidence ?? 0, allowed: evaluation.allowed, at: new Date().toISOString() }, ...p].slice(0, 5))
      toast.success('Permit analyzed', { description: `Confidence: ${Math.round((extraction.confidence ?? 0) * 100)}%` })
    } catch (err) {
      console.error('[OCR] Failed:', err)
      toast.error('Analysis failed', { description: err instanceof Error ? err.message : 'Please try again' })
      setState(INIT)
    }
  }, [activeRules])

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }, [handleFile])

  const updateOverride = useCallback(<K extends keyof OcrExtraction>(key: K, val: OcrExtraction[K]) => {
    setState(s => ({ ...s, overrides: { ...s.overrides, [key]: val } }))
  }, [])

  const live = useMemo<OcrExtraction | null>(() => { if (!state.extraction) return null; return { ...state.extraction, ...state.overrides } }, [state.extraction, state.overrides])
  const liveEval = useMemo<RuleEvaluationResult | null>(() => { if (!live) return null; return evaluateParkingRules(activeRules, { plateNumber: live.plateNumber, vehicleType: live.vehicleType, permitNumber: live.permitNumber, permitExpiry: live.permitExpiry }) }, [live, activeRules])

  const confirmMut = useMutation({
    mutationFn: async () => {
      if (!live || !liveEval) throw new Error('No extraction')
      const matchedSpot = spots.find(s => s.id === state.matchedSpotId) || null
      let vehicleId: string | null = null
      if (live.plateNumber) {
        const existing = await blink.db.table<Vehicle>('vehicles').list()
        const list = Array.isArray(existing) ? existing : []
        const found = list.find(v => v.plateNumber?.toUpperCase() === live.plateNumber.toUpperCase())
        if (found) vehicleId = found.id
        else { const c = await blink.db.table<Vehicle>('vehicles').create({ plateNumber: live.plateNumber.toUpperCase(), make: live.vehicleMake || '', model: live.vehicleModel || '', color: live.vehicleColor || '', vehicleType: live.vehicleType || 'car', ownerName: live.ownerName || '', ownerPhone: '', permitNumber: live.permitNumber || '', permitExpiry: live.permitExpiry || '', isRegistered: live.permitNumber ? 1 : 0, createdBy: '' } as Vehicle); vehicleId = c.id }
      }
      const sessionSpotId = matchedSpot?.id || spots[0]?.id || ''
      if (!sessionSpotId) throw new Error('No parking spots available. Create one first.')
      const session = await blink.db.table<ParkingSession>('parking_sessions').create({
        spotId: sessionSpotId, vehicleId: vehicleId ?? undefined, plateNumber: live.plateNumber || '', startTime: new Date().toISOString(), status: liveEval.allowed ? 'active' : 'violation',
        validatedByOcr: 1, ocrImageUrl: state.imageUrl, ocrResult: JSON.stringify({ extraction: live, evaluation: liveEval }), notes: live.notes || '', createdBy: '',
      } as ParkingSession)
      await auditLog({ action: 'create', entityType: 'parking_session', entityId: session.id, changes: { plateNumber: live.plateNumber, validatedByOcr: true, spotName: matchedSpot?.name, status: session.status } })
      return { session, matchedSpot }
    },
    onSuccess: ({ session, matchedSpot }) => {
      queryClient.invalidateQueries({ queryKey: ['parking_sessions'] }); queryClient.invalidateQueries({ queryKey: ['parking_spots'] }); queryClient.invalidateQueries({ queryKey: ['vehicles'] }); queryClient.invalidateQueries({ queryKey: ['audit_logs'] })
      setState(s => ({ ...s, step: 'done' }))
      if (session.status === 'violation') toast.error('Session created — rule violation', { description: liveEval?.reason ?? '' })
      else toast.success('Session created', { description: `Plate ${live?.plateNumber} at ${matchedSpot?.name ?? 'spot'}` })
    },
    onError: (err: Error) => { toast.error('Failed to confirm', { description: err.message }); setState(s => ({ ...s, step: 'review' })) },
  })

  const reset = () => setState(INIT)
  const confidencePct = live ? Math.round((live.confidence ?? 0) * 100) : 0
  const confColor = confidencePct >= 85 ? 'text-emerald-600 dark:text-emerald-400' : confidencePct >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
  const confBar = confidencePct >= 85 ? 'bg-emerald-500' : confidencePct >= 60 ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <Page>
      <PageHeader>
        <div><PageTitle>OCR Scanner</PageTitle><p className="text-xs text-muted-foreground">Upload a permit image to extract fields and validate against active rules.</p></div>
        <PageActions>{state.step !== 'upload' && <Button variant="outline" size="sm" onClick={reset}><RotateCcw className="h-4 w-4 mr-1.5" />New Scan</Button>}</PageActions>
      </PageHeader>
      <PageBody>
        <Tabs defaultValue="scanner" className="space-y-5">
          <TabsList>
            <TabsTrigger value="scanner"><ScanLine className="h-3.5 w-3.5 mr-1.5" />Scanner</TabsTrigger>
            <TabsTrigger value="recent"><Camera className="h-3.5 w-3.5 mr-1.5" />Recent ({recentScans.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="scanner" className="space-y-5 mt-0">
            {state.step === 'upload' && (
              <div onDragOver={e => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${isDragging ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/40 hover:bg-muted/30'}`}>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"><Upload className="h-6 w-6" /></span>
                <div><p className="text-sm font-medium">Drop a permit image here</p><p className="text-xs text-muted-foreground mt-1">or click to browse · JPG, PNG, WebP up to 10MB</p></div>
                <Button variant="outline" size="sm" type="button" onClick={e => { e.stopPropagation(); fileRef.current?.click() }}><ImageIcon className="h-4 w-4 mr-1.5" />Choose file</Button>
              </div>
            )}

            {state.step === 'analyzing' && (
              <Card className="p-8">
                <div className="flex flex-col items-center gap-4 max-w-md mx-auto text-center">
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent"><Sparkles className="h-7 w-7" /></span>
                  <p className="text-sm font-semibold">Analyzing permit</p>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">{state.fileName}</p>
                  <div className="w-full space-y-2"><Skeleton className="h-2 w-full" /><Skeleton className="h-2 w-4/5" /></div>
                  <ul className="text-xs text-muted-foreground space-y-1 text-left w-full">
                    <li className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin text-accent" />Uploading to secure storage</li>
                    <li className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin text-accent" />Running AI vision extraction</li>
                  </ul>
                </div>
              </Card>
            )}

            {(state.step === 'review' || state.step === 'saving' || state.step === 'done') && live && liveEval && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  <Card className="overflow-hidden">
                    <div className="relative aspect-[4/3] bg-muted">
                      {state.imageUrl ? <img src={state.imageUrl} alt={state.fileName} className="h-full w-full object-contain" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-8 w-8" /></div>}
                    </div>
                    <div className="p-3 border-t border-border">
                      <p className="text-xs font-medium truncate">{state.fileName}</p>
                      <div className="flex items-center justify-between mt-1.5"><span className="text-[10px] text-muted-foreground uppercase tracking-wider">Confidence</span><span className={`text-sm font-semibold tabular-nums ${confColor}`}>{confidencePct}%</span></div>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden"><div className={`h-full transition-all ${confBar}`} style={{ width: `${confidencePct}%` }} /></div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      {liveEval.allowed
                        ? <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shrink-0"><CheckCircle2 className="h-5 w-5" /></span>
                        : <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 shrink-0"><XCircle className="h-5 w-5" /></span>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{liveEval.allowed ? 'Rules passed' : 'Rule violation'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{liveEval.reason}</p>
                        {liveEval.matchedRuleName && <Badge variant="outline" className="mt-2 text-[10px]">{liveEval.matchedRuleName}</Badge>}
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 space-y-2">
                    <Label className="text-xs">Assign to spot</Label>
                    <Select value={state.matchedSpotId} onValueChange={id => setState(s => ({ ...s, matchedSpotId: id }))}>
                      <SelectTrigger><SelectValue placeholder="Select parking spot" /></SelectTrigger>
                      <SelectContent>{spots.map(s => <SelectItem key={s.id} value={s.id}>{s.name} {s.locationName ? `· ${s.locationName}` : ''}</SelectItem>)}</SelectContent>
                    </Select>
                  </Card>
                </div>
                <div className="lg:col-span-3 space-y-4">
                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div><h3 className="text-sm font-semibold">Extracted fields</h3><p className="text-xs text-muted-foreground">Edit before confirming</p></div>
                      <Badge variant="outline" className="text-[10px]"><Sparkles className="h-3 w-3 mr-1" />AI extracted</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(['plateNumber', 'permitNumber', 'permitExpiry', 'permitType', 'ownerName', 'vehicleType', 'vehicleMake', 'vehicleModel', 'vehicleColor', 'notes'] as const).map(key => (
                        <div key={key} className="space-y-1">
                          <Label htmlFor={key} className="text-[11px] text-muted-foreground uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                          <Input id={key} value={live[key]} onChange={e => updateOverride(key, e.target.value as OcrExtraction[typeof key])} className={key === 'plateNumber' || key === 'permitNumber' ? 'font-mono tabular-nums text-sm' : 'text-sm'} />
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card className="p-4">
                    {state.step !== 'done' ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground">{liveEval.allowed ? 'A new parking session will be created with OCR validation.' : 'Session will be created but flagged as a violation.'}</p>
                        </div>
                        <Button onClick={() => { setState(s => ({ ...s, step: 'saving' })); confirmMut.mutate() }} disabled={state.step === 'saving'}>
                          <Save className="h-4 w-4 mr-1.5" />Confirm & create session<ArrowRight className="h-4 w-4 ml-1.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /><p className="text-xs font-medium">Session created. Vehicle and session are in the registry.</p></div>
                    )}
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recent" className="mt-0">
            <Card>
              {recentScans.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground"><Camera className="h-6 w-6 mx-auto mb-2 opacity-50" />No recent scans.</div> : (
                <ul className="divide-y divide-border">
                  {recentScans.map(s => (
                    <li key={s.id} className="flex items-center gap-3 p-4">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${s.allowed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
                        {s.allowed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </span>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{s.plate}</p><p className="text-[11px] text-muted-foreground">{formatRelativeTime(s.at)} · {Math.round(s.confidence * 100)}% confidence</p></div>
                      <Badge variant={s.allowed ? 'secondary' : 'destructive'}>{s.allowed ? 'Allowed' : 'Violation'}</Badge>
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
