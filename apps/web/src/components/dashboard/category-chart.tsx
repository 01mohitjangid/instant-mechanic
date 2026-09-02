'use client';

import type { ServiceBreakdownEntry } from '@instant-mechanic/shared';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatCompactCurrency, formatCurrency } from '@/lib/format';

const config = {
  revenue: { label: 'Revenue', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/** Revenue by service category, horizontal so long category names stay readable. */
export function CategoryChart({ data }: { data: ServiceBreakdownEntry[] }) {
  const rows = [...data]
    .map((entry) => ({ ...entry, revenueValue: Number(entry.revenue) }))
    .sort((a, b) => b.revenueValue - a.revenueValue);

  return (
    <ChartContainer config={config} className="h-[300px] w-full">
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => formatCompactCurrency(value)}
          className="text-xs"
        />
        <YAxis
          type="category"
          dataKey="category"
          tickLine={false}
          axisLine={false}
          width={132}
          className="text-xs"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatCurrency(Number(value), true)}
              labelKey="category"
            />
          }
        />
        <Bar
          dataKey="revenueValue"
          name="revenue"
          fill="var(--color-revenue)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
