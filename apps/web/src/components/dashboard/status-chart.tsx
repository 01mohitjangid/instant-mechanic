'use client';

import type { StatusBreakdownEntry } from '@instant-mechanic/shared';
import { Cell, Label, Pie, PieChart } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { BOOKING_STATUS_FILL } from '@/lib/status';
import { formatNumber } from '@/lib/format';

/** Booking status mix. Colours come from the same tokens as the status badges. */
export function StatusChart({ data }: { data: StatusBreakdownEntry[] }) {
  const slices = data.filter((entry) => entry.bookings > 0);
  const total = slices.reduce((sum, entry) => sum + entry.bookings, 0);

  const config = Object.fromEntries(
    slices.map((entry) => [
      entry.status,
      { label: entry.label, color: BOOKING_STATUS_FILL[entry.status] },
    ])
  ) satisfies ChartConfig;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <ChartContainer config={config} className="mx-auto aspect-square h-[220px]">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
          <Pie data={slices} dataKey="bookings" nameKey="label" innerRadius={62} strokeWidth={3}>
            {slices.map((entry) => (
              <Cell key={entry.status} fill={BOOKING_STATUS_FILL[entry.status]} />
            ))}
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !('cx' in viewBox)) return null;
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                    <tspan
                      x={viewBox.cx}
                      dy="-0.1em"
                      className="fill-foreground text-2xl font-semibold"
                    >
                      {formatNumber(total)}
                    </tspan>
                    <tspan x={viewBox.cx} dy="1.5em" className="fill-muted-foreground text-xs">
                      bookings
                    </tspan>
                  </text>
                );
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      {/* A written legend beside the donut: a colour alone is not readable for
          anyone who cannot distinguish two of these hues. */}
      <ul className="grid flex-1 gap-2">
        {slices.map((entry) => (
          <li key={entry.status} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: BOOKING_STATUS_FILL[entry.status] }}
            />
            <span className="flex-1 truncate text-muted-foreground">{entry.label}</span>
            <span className="tabular font-medium">{formatNumber(entry.bookings)}</span>
            <span className="tabular w-12 text-right text-xs text-muted-foreground">
              {total === 0 ? '0%' : `${Math.round((entry.bookings / total) * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
