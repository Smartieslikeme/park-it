import { Card } from '@blinkdotnew/ui'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'

interface Props { data: Array<{ day: string; occupied: number; available: number }> }

const PRIMARY = 'hsl(var(--chart-2))'
const MUTED = 'hsl(var(--muted-foreground) / 0.35)'

export function OccupancyChart({ data }: Props) {
  const hasData = data.some(d => d.occupied + d.available > 0)
  if (!data.length) return (<Card className="p-6"><h3 className="text-sm font-semibold">Weekly Occupancy</h3><p className="text-xs text-muted-foreground">No session data.</p></Card>)

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Weekly Occupancy</h3>
          <p className="text-xs text-muted-foreground">{hasData ? 'Sessions from the last 7 days' : 'Awaiting first sessions'}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: PRIMARY }} />Occupied</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: MUTED }} />Available</span>
        </div>
      </div>
      <div
        className="h-[220px] w-full"
        role="img"
        aria-label={`Weekly occupancy bar chart. ${data.map(d => `${d.day}: ${d.occupied} occupied, ${d.available} available`).join('. ')}.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'hsl(var(--accent) / 0.08)' }} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px', color: 'hsl(var(--popover-foreground))' }} />
            <Bar dataKey="available" stackId="a" fill={MUTED} radius={[0, 0, 0, 0]} name="Available" />
            <Bar dataKey="occupied" stackId="a" fill={PRIMARY} radius={[3, 3, 0, 0]} name="Occupied">{data.map((_, i) => <Cell key={i} fill={PRIMARY} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
