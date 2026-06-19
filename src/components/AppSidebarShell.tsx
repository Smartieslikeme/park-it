/**
 * Collapsible SaaS sidebar for Park-It.
 * Active state computed from current route.
 */
import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import {
  Avatar, AvatarFallback, Button,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@blinkdotnew/ui'
import {
  LayoutDashboard, MapPin, ShieldCheck, Car,
  ClipboardList, ScanLine, LogOut, PanelLeft,
} from 'lucide-react'
import { useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

const SIDEBAR_KEY = 'sidebar_collapsed'

interface NavItemDef { href: string; icon: ReactNode; label: string }

const NAV_ITEMS: NavItemDef[] = [
  { href: '/', icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard' },
  { href: '/spots', icon: <MapPin className="h-4 w-4" />, label: 'Parking Spots' },
  { href: '/rules', icon: <ShieldCheck className="h-4 w-4" />, label: 'Rules' },
  { href: '/ocr', icon: <ScanLine className="h-4 w-4" />, label: 'OCR Scanner' },
  { href: '/vehicles', icon: <Car className="h-4 w-4" />, label: 'Vehicles' },
  { href: '/audit-logs', icon: <ClipboardList className="h-4 w-4" />, label: 'Audit Logs' },
]

function NavItem({ item, collapsed, isActive }: { item: NavItemDef; collapsed: boolean; isActive: boolean }) {
  const link = (
    <a
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md text-sm transition-colors cursor-pointer',
        collapsed ? 'justify-center w-8 h-8 mx-auto' : 'px-3 py-2 w-full',
        isActive ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}>
      <span className="shrink-0" aria-hidden="true">{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </a>
  )
  if (!collapsed) return link
  return (<Tooltip><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{item.label}</TooltipContent></Tooltip>)
}

export function AppSidebarShell() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SIDEBAR_KEY) === 'true'
  })

  const toggle = useCallback(() => {
    setCollapsed(v => { const next = !v; localStorage.setItem(SIDEBAR_KEY, String(next)); return next })
  }, [])

  const location = useLocation()
  const currentPath = location.pathname
  const isActive = (href: string) => href === '/' ? currentPath === '/' : currentPath === href || currentPath.startsWith(href + '/')

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn(
        'flex flex-col h-full bg-background border-r border-border overflow-hidden',
        'transition-[width] duration-200 ease-linear shrink-0',
        collapsed ? 'w-[3rem]' : 'w-[15rem]'
      )}>
        <div className={cn('flex items-center gap-2 shrink-0 border-b border-border h-[52px] px-3', collapsed && 'justify-center px-2')}>
          {!collapsed && (<>
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-accent text-accent-foreground text-xs font-bold shrink-0" aria-hidden="true">P</div>
            <span className="flex-1 font-semibold text-sm truncate">Park-It</span>
          </>)}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={toggle}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
              >
                <PanelLeft className={cn('h-4 w-4 transition-transform duration-200', collapsed && 'rotate-180')} aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</TooltipContent>
          </Tooltip>
        </div>

        <nav aria-label="Main navigation" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-0.5">
          {!collapsed && (<p className="px-3 pt-1 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider" aria-hidden="true">Management</p>)}
          {NAV_ITEMS.map(item => (<NavItem key={item.href} item={item} collapsed={collapsed} isActive={isActive(item.href)} />))}
        </nav>

        <div className={cn('shrink-0 border-t border-border', collapsed ? 'flex flex-col items-center gap-1 p-2' : 'p-3 space-y-1')}>
          {collapsed ? (
            <Tooltip><TooltipTrigger asChild>
              <button aria-label="User menu" className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors cursor-pointer">
                <Avatar className="h-6 w-6 shrink-0"><AvatarFallback className="text-[10px] bg-muted" aria-hidden="true">U</AvatarFallback></Avatar>
              </button>
            </TooltipTrigger><TooltipContent side="right">User</TooltipContent></Tooltip>
          ) : (
            <button aria-label="User menu" className="flex items-center gap-2 rounded-md hover:bg-accent transition-colors cursor-pointer w-full px-2 py-1.5">
              <Avatar className="h-6 w-6 shrink-0"><AvatarFallback className="text-[10px] bg-muted" aria-hidden="true">U</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium leading-tight truncate">User</p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">user@example.com</p>
              </div>
            </button>
          )}
          {collapsed ? (
            <Tooltip><TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" aria-label="Sign out">
                <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Button>
            </TooltipTrigger><TooltipContent side="right">Sign out</TooltipContent></Tooltip>
          ) : (
            <Button type="button" variant="ghost" size="sm" className="w-full justify-start px-2 gap-2 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" /> Sign out
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
