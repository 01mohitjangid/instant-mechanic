'use client';

import type { TimeSeriesPoint } from '@instant-mechanic/shared';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatChartDay, formatCompactCurrency, formatCurrency } from '@/lib/format';

const config = {
  revenue: { label: 'Revenue', color: 'var(--chart-2)' },
} satisfies ChartConfig;

/** Earned revenue per day. Money arrives as a string, so it is parsed here. */
export function RevenueChart({ series }: { series: TimeSeriesPoint[] }) {
  const data = series.map((point) => ({ date: point.date, revenue: Number(point.revenue) }));

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
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
          width={52}
          tickFormatter={(value: number) => formatCompactCurrency(value)}
          className="text-xs"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => formatChartDay(String(label))}
              formatter={(value) => formatCurrency(Number(value), true)}
            />
          }
        />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
