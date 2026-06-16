import type { ParkingRule, RuleConfigTimeRestriction, RuleConfigPermitRequired, RuleConfigVehicleType, RuleEvaluationResult } from '@/types/park-it'

/**
 * Evaluates parking rules against a given context.
 * Returns the first violated rule (highest priority first), or { allowed: true }.
 */
export function evaluateParkingRules(
  rules: ParkingRule[],
  context: {
    plateNumber?: string
    vehicleType?: string
    permitNumber?: string
    permitExpiry?: string
    currentTime?: Date
  }
): RuleEvaluationResult {
  const now = context.currentTime ?? new Date()

  // Sort by priority descending
  const sorted = [...rules]
    .filter(r => Number(r.isActive) > 0)
    .sort((a, b) => b.priority - a.priority)

  for (const rule of sorted) {
    const result = evaluateRule(rule, { ...context, currentTime: now })
    if (!result.allowed) return result
  }

  return { allowed: true, reason: 'All rules passed' }
}

function evaluateRule(
  rule: ParkingRule,
  context: Required<Pick<Parameters<typeof evaluateParkingRules>[1], 'currentTime'>> & Omit<Parameters<typeof evaluateParkingRules>[1], 'currentTime'>
): RuleEvaluationResult {
  try {
    const config = JSON.parse(rule.ruleConfig)

    switch (rule.ruleType) {
      case 'time_restriction': {
        const tc = config as RuleConfigTimeRestriction
        const day = context.currentTime.getDay()
        if (!tc.allowedDays.includes(day)) {
          return { allowed: false, reason: `Parking not allowed on this day (${rule.name})`, matchedRuleId: rule.id, matchedRuleName: rule.name }
        }
        if (tc.startTime && tc.endTime) {
          const minutes = context.currentTime.getHours() * 60 + context.currentTime.getMinutes()
          const [sh, sm] = tc.startTime.split(':').map(Number)
          const [eh, em] = tc.endTime.split(':').map(Number)
          const startMin = sh * 60 + sm
          const endMin = eh * 60 + em
          if (minutes < startMin || minutes > endMin) {
            return { allowed: false, reason: `Parking not allowed at this time (${rule.name}: ${tc.startTime}-${tc.endTime})`, matchedRuleId: rule.id, matchedRuleName: rule.name }
          }
        }
        break
      }

      case 'permit_required': {
        const pc = config as RuleConfigPermitRequired
        if (!context.permitNumber) {
          return { allowed: false, reason: `Permit required for this spot (${rule.name})`, matchedRuleId: rule.id, matchedRuleName: rule.name }
        }
        if (pc.permitTypes.length > 0 && !pc.permitTypes.includes(context.permitNumber)) {
          return { allowed: false, reason: `Invalid permit type (${rule.name})`, matchedRuleId: rule.id, matchedRuleName: rule.name }
        }
        if (pc.requireValidExpiry && context.permitExpiry) {
          const expiry = new Date(context.permitExpiry)
          if (expiry < context.currentTime) {
            return { allowed: false, reason: `Permit expired (${rule.name})`, matchedRuleId: rule.id, matchedRuleName: rule.name }
          }
        }
        break
      }

      case 'vehicle_type': {
        const vc = config as RuleConfigVehicleType
        if (!context.vehicleType || !vc.allowedTypes.includes(context.vehicleType)) {
          return { allowed: false, reason: `Vehicle type not allowed (${rule.name})`, matchedRuleId: rule.id, matchedRuleName: rule.name }
        }
        break
      }

      default:
        break
    }
  } catch {
    return { allowed: true, reason: 'Rule config parse error — skipped' }
  }

  return { allowed: true, reason: 'Rule passed' }
}
