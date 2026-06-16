import type { ParkingSpot } from '@/types/park-it'

export const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }> = {
  available: { label: 'Available', variant: 'secondary', className: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' },
  occupied: { label: 'Occupied', variant: 'destructive', className: '' },
  maintenance: { label: 'Maintenance', variant: 'secondary', className: 'border-amber-500/30 text-amber-600 dark:text-amber-400' },
  reserved: { label: 'Reserved', variant: 'secondary', className: 'border-blue-500/30 text-blue-600 dark:text-blue-400' },
}

export const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  standard: { label: 'Standard', className: 'bg-muted text-muted-foreground border-muted' },
  handicap: { label: 'Handicap', className: 'border-blue-500/30 text-blue-600 dark:text-blue-400' },
  electric: { label: 'Electric', className: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' },
  compact: { label: 'Compact', className: 'border-gray-500/30 text-gray-600 dark:text-gray-400' },
  motorcycle: { label: 'Motorcycle', className: 'border-orange-500/30 text-orange-600 dark:text-orange-400' },
  reserved: { label: 'Reserved', className: 'border-purple-500/30 text-purple-600 dark:text-purple-400' },
}

export interface SpotFormState {
  name: string
  locationName: string
  lat: string
  lng: string
  floor: string
  section: string
  spotType: ParkingSpot['spotType']
  status: ParkingSpot['status']
  notes: string
}

export const EMPTY_FORM: SpotFormState = {
  name: '',
  locationName: '',
  lat: '',
  lng: '',
  floor: '',
  section: '',
  spotType: 'standard',
  status: 'available',
  notes: '',
}
