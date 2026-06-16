import type { ParkingSession, ParkingSpot, Vehicle } from '@/types/park-it'

/**
 * Compute dashboard KPIs from raw data. Pure functions, no side effects.
 */
export interface DashboardKpis {
  totalSpots: number
  availableSpots: number
  occupiedSpots: number
  utilizationPct: number
  activeSessions: number
  completedToday: number
  violations: number
  registeredVehicles: number
  totalVehicles: number
  activeRules: number
  ocrValidatedToday: number
}

export function computeKpis(input: {
  spots: ParkingSpot[]
  sessions: ParkingSession[]
  vehicles: Vehicle[]
  rules?: { isActive: number | string }[]
}): DashboardKpis {
  const spots = input.spots
  const sessions = input.sessions
  const vehicles = input.vehicles

  const totalSpots = spots.length
  const availableSpots = spots.filter((s) => s.status === 'available').length
  const occupiedSpots = spots.filter((s) => s.status === 'occupied').length
  const utilizationPct = totalSpots > 0 ? Math.round((occupiedSpots / totalSpots) * 100) : 0

  const activeSessions = sessions.filter((s) => s.status === 'active').length

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const completedToday = sessions.filter((s) => {
    if (s.status !== 'completed') return false
    const t = s.endTime ?? s.updatedAt
    if (!t) return false
    return new Date(t) >= startOfDay
  }).length

  const violations = sessions.filter((s) => s.status === 'violation').length

  const registeredVehicles = vehicles.filter((v) => Number(v.isRegistered) > 0).length
  const totalVehicles = vehicles.length

  const activeRules = (input.rules ?? []).filter((r) => Number(r.isActive) > 0).length

  const ocrValidatedToday = sessions.filter((s) => {
    if (Number(s.validatedByOcr) <= 0) return false
    const t = s.createdAt
    if (!t) return false
    return new Date(t) >= startOfDay
  }).length

  return {
    totalSpots, availableSpots, occupiedSpots, utilizationPct,
    activeSessions, completedToday, violations,
    registeredVehicles, totalVehicles, activeRules, ocrValidatedToday,
  }
}

export function buildWeeklySeries(
  sessions: ParkingSession[],
  spots: ParkingSpot[],
): Array<{ day: string; occupied: number; available: number }> {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days: Array<{ day: string; occupied: number; available: number }> = []
  const totalSpots = spots.length

  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)

    const count = sessions.filter((s) => {
      const t = s.startTime
      if (!t) return false
      const dt = new Date(t)
      return dt >= d && dt < next
    }).length

    const occupied = Math.min(count, totalSpots)
    const available = Math.max(totalSpots - occupied, 0)
    days.push({ day: dayLabels[d.getDay()], occupied, available })
  }

  return days
}

export function buildSpotTypeBreakdown(spots: ParkingSpot[]): Array<{ type: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const s of spots) {
    counts[s.spotType] = (counts[s.spotType] ?? 0) + 1
  }
  return Object.entries(counts).map(([type, count]) => ({ type, count }))
}

export function formatRelativeTime(iso: string): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const now = Date.now()
  const diff = now - then
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'Yesterday'
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatNumber(n: number): string {
  return n.toLocaleString()
}
