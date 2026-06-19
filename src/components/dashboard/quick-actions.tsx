import { Link } from '@tanstack/react-router'
import { Card } from '@blinkdotnew/ui'
import { Plus, ScanLine, ShieldCheck, MapPin } from 'lucide-react'

const ACTIONS = [
  { label: 'Add Parking Spot', desc: 'Register a new spot', to: '/spots', icon: <MapPin className="h-4 w-4" />, accent: 'from-sky-500/15 to-sky-500/0 text-sky-700 dark:text-sky-300' },
  { label: 'Create Rule', desc: 'Define a parking rule', to: '/rules', icon: <ShieldCheck className="h-4 w-4" />, accent: 'from-emerald-500/15 to-emerald-500/0 text-emerald-700 dark:text-emerald-300' },
  { label: 'Scan Permit', desc: 'OCR-validate a permit', to: '/ocr', icon: <ScanLine className="h-4 w-4" />, accent: 'from-purple-500/15 to-purple-500/0 text-purple-700 dark:text-purple-300' },
  { label: 'Register Vehicle', desc: 'Add a vehicle', to: '/vehicles', icon: <Plus className="h-4 w-4" />, accent: 'from-amber-500/15 to-amber-500/0 text-amber-700 dark:text-amber-300' },
]

export function QuickActions() {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-4">Quick Actions</h3>
      <nav aria-label="Quick actions" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ACTIONS.map(a => (
          <Link key={a.to} to={a.to} className="group flex items-center gap-3 rounded-md border border-border bg-card p-3 transition-all hover:border-accent/40 hover:shadow-sm">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br ${a.accent} shrink-0`} aria-hidden="true">{a.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight truncate group-hover:text-accent transition-colors">{a.label}</p>
              <p className="text-[11px] text-muted-foreground leading-tight truncate">{a.desc}</p>
            </div>
          </Link>
        ))}
      </nav>
    </Card>
  )
}
