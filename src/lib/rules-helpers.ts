import { z } from 'zod'
import type { ParkingRule } from '@/types/park-it'

export const RULE_TYPES = [
  { value: 'time_restriction', label: 'Time Restriction' },
  { value: 'permit_required', label: 'Permit Required' },
  { value: 'vehicle_type', label: 'Vehicle Type' },
  { value: 'duration_limit', label: 'Duration Limit' },
  { value: 'custom', label: 'Custom' },
] as const

export const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
] as const

export const TYPE_LABEL: Record<string, string> = {
  time_restriction: 'Time Restriction',
  permit_required: 'Permit Required',
  vehicle_type: 'Vehicle Type',
  duration_limit: 'Duration Limit',
  custom: 'Custom',
}

export const ruleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  spotId: z.string().min(1, 'Spot is required'),
  ruleType: z.enum(['time_restriction', 'permit_required', 'vehicle_type', 'duration_limit', 'custom']),
  priority: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  allowedDays: z.array(z.number()).default([]),
  startTime: z.string().default(''),
  endTime: z.string().default(''),
  maxDurationMinutes: z.coerce.number().int().positive().optional(),
  permitTypesStr: z.string().default(''),
  requireValidExpiry: z.boolean().default(false),
  allowedTypesStr: z.string().default(''),
})

export type RuleFormValues = z.infer<typeof ruleFormSchema>

export function getDefaultFormValues(existing?: Partial<RuleFormValues>): RuleFormValues {
  return {
    name: '',
    spotId: '',
    ruleType: 'time_restriction',
    priority: 0,
    isActive: true,
    allowedDays: [],
    startTime: '',
    endTime: '',
    maxDurationMinutes: undefined,
    permitTypesStr: '',
    requireValidExpiry: false,
    allowedTypesStr: '',
    ...existing,
  }
}

export function buildRuleConfig(values: RuleFormValues): object {
  switch (values.ruleType) {
    case 'time_restriction':
      return { allowedDays: values.allowedDays, startTime: values.startTime, endTime: values.endTime, maxDurationMinutes: values.maxDurationMinutes ?? undefined }
    case 'permit_required':
      return { permitTypes: values.permitTypesStr.split(',').map((s) => s.trim()).filter(Boolean), requireValidExpiry: values.requireValidExpiry }
    case 'vehicle_type':
      return { allowedTypes: values.allowedTypesStr.split(',').map((s) => s.trim()).filter(Boolean) }
    default:
      return {}
  }
}

export function parseRuleConfigForForm(rule: ParkingRule): Partial<RuleFormValues> {
  let cfg: Record<string, unknown> = {}
  try { cfg = JSON.parse(rule.ruleConfig || '{}') } catch { /* ignore */ }

  const base: Partial<RuleFormValues> = {
    name: rule.name,
    spotId: rule.spotId,
    ruleType: rule.ruleType,
    priority: rule.priority,
    isActive: Number(rule.isActive) > 0,
  }

  switch (rule.ruleType) {
    case 'time_restriction': {
      const c = cfg as { allowedDays?: number[]; startTime?: string; endTime?: string; maxDurationMinutes?: number }
      return { ...base, allowedDays: c.allowedDays ?? [], startTime: c.startTime ?? '', endTime: c.endTime ?? '', maxDurationMinutes: c.maxDurationMinutes }
    }
    case 'permit_required': {
      const c = cfg as { permitTypes?: string[]; requireValidExpiry?: boolean }
      return { ...base, permitTypesStr: (c.permitTypes ?? []).join(', '), requireValidExpiry: c.requireValidExpiry ?? false }
    }
    case 'vehicle_type': {
      const c = cfg as { allowedTypes?: string[] }
      return { ...base, allowedTypesStr: (c.allowedTypes ?? []).join(', ') }
    }
    default:
      return base
  }
}

export function getTypeBadgeClass(ruleType: string): string {
  switch (ruleType) {
    case 'time_restriction': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    case 'permit_required': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
    case 'vehicle_type': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800'
    case 'duration_limit': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300 border-gray-200 dark:border-gray-800'
  }
}
