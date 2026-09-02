'use client';

import type { TimeSeriesPoint } from '@instant-mechanic/shared';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatChartDay, formatNumber } from '@/lib/format';

const config = {
  bookings: { label: 'Bookings', color: 'var(--chart-1)' },
  completed: { label: 'Completed', color: 'var(--chart-2)' },
  cancelled: { label: 'Cancelled', color: 'var(--chart-6)' },
} satisfies ChartConfig;

/** Bookings per day: total, completed and cancelled on one axis. */
export function VolumeChart({ series }: { series: TimeSeriesPoint[] }) {
  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <AreaChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          {Object.entries(config).map(([key, entry]) => (
            <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={entry.color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={entry.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tickFormatter={formatChartDay}
          className="text-xs"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={34}
          allowDecimals={false}
          tickFormatter={(value: number) => formatNumber(value)}
          className="text-xs"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent labelFormatter={(label) => formatChartDay(String(label))} />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="bookings"
          type="monotone"
          stroke="var(--color-bookings)"
          fill="url(#fill-bookings)"
          strokeWidth={2}
        />
        <Area
          dataKey="completed"
          type="monotone"
          stroke="var(--color-completed)"
          fill="url(#fill-completed)"
          strokeWidth={2}
        />
        <Area
          dataKey="cancelled"
          type="monotone"
          stroke="var(--color-cancelled)"
          fill="url(#fill-cancelled)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
