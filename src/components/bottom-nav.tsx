import { Link, useRouterState } from '@tanstack/react-router'
import { Home, Clock, ScanLine, Car, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/history', label: 'History', icon: Clock },
  { to: '/scan', label: 'Scan', icon: ScanLine, isCenter: true },
  { to: '/vehicles', label: 'Vehicles', icon: Car },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

export function BottomNav() {
  const router = useRouterState()
  const path = router.location.pathname

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border"
         style={{ boxShadow: '0 -4px 20px hsl(40 20% 0% / 0.06)' }}>
      <div className="flex items-end justify-around max-w-lg mx-auto h-16"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.to === '/'
            ? path === '/'
            : path.startsWith(item.to)

          if (item.isCenter) {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative -mt-6 flex flex-col items-center group"
              >
                <div
                  className={`flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200 group-active:scale-90 ${
                    isActive ? 'bg-primary scale-105' : 'bg-primary'
                  }`}
                  style={{ boxShadow: '0 4px 16px hsl(44 100% 47% / 0.35)' }}
                >
                  <item.icon className="w-7 h-7 text-primary-foreground" strokeWidth={2} />
                </div>
                <span className={`text-[10px] mt-1 font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {item.label}
                </span>
              </Link>
            )
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center gap-0.5 py-2 px-3 transition-colors group"
            >
              <item.icon
                className={`w-5 h-5 transition-all duration-200 group-active:scale-90 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] transition-colors ${
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
              }`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
