import type { ReactNode } from 'react'
import { BottomNav } from './bottom-nav'

/**
 * Mobile-first app shell with bottom navigation.
 * Every authenticated page wraps in this. Onboarding does NOT.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
