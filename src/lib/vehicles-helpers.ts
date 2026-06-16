import type { Vehicle } from '@/types/park-it'

export const VEHICLE_TYPE_OPTIONS = [
  { value: 'car', label: 'Car' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'suv', label: 'SUV' },
  { value: 'truck', label: 'Truck' },
  { value: 'van', label: 'Van' },
  { value: 'other', label: 'Other' },
] as const

export function vehicleTypeLabel(t: string): string {
  return VEHICLE_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t
}

export function isPermitValid(v: Vehicle): boolean {
  if (!v.permitNumber) return false
  if (!v.permitExpiry) return true
  return new Date(v.permitExpiry).getTime() > Date.now()
}

export interface VehicleFormState {
  plateNumber: string
  make: string
  model: string
  color: string
  vehicleType: string
  ownerName: string
  ownerPhone: string
  permitNumber: string
  permitExpiry: string
  isRegistered: boolean
}

export const EMPTY_VEHICLE_FORM: VehicleFormState = {
  plateNumber: '',
  make: '',
  model: '',
  color: '',
  vehicleType: 'car',
  ownerName: '',
  ownerPhone: '',
  permitNumber: '',
  permitExpiry: '',
  isRegistered: false,
}

export function toFormState(v: Vehicle): VehicleFormState {
  return {
    plateNumber: v.plateNumber ?? '',
    make: v.make ?? '',
    model: v.model ?? '',
    color: v.color ?? '',
    vehicleType: v.vehicleType || 'car',
    ownerName: v.ownerName ?? '',
    ownerPhone: v.ownerPhone ?? '',
    permitNumber: v.permitNumber ?? '',
    permitExpiry: v.permitExpiry ?? '',
    isRegistered: Number(v.isRegistered) > 0,
  }
}
