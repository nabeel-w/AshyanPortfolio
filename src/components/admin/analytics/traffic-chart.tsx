"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { DayPoint } from "@/features/analytics/queries";

// Emphasis, not a categorical palette (brand is black · white · red): visitors in warm grey,
// film plays in red. Both are counts, so they share one axis.
const config = {
  visitors: { label: "Visitors", color: "#b8b3ab" },
  plays: { label: "Film plays", color: "#e3202d" },
} satisfies ChartConfig;

const tick = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (day: string) => tick.format(new Date(`${day}T00:00:00Z`));
const axisNum = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}K` : n.toLocaleString("en"));

export function TrafficChart({ data }: { data: DayPoint[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full md:h-72">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
        <defs>
          <linearGradient id="fill-visitors" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-visitors)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--color-visitors)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fill-plays" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-plays)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--color-plays)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgb(244 241 236 / 0.08)" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} tickFormatter={fmt} />
        <YAxis width={40} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={axisNum} />
        <ChartTooltip cursor={{ stroke: "rgb(244 241 236 / 0.25)" }} content={<ChartTooltipContent indicator="line" labelFormatter={(_, p) => fmt(String(p?.[0]?.payload?.day ?? ""))} />} />
        <Area dataKey="visitors" type="monotone" stroke="var(--color-visitors)" strokeWidth={2} fill="url(#fill-visitors)" activeDot={{ r: 4, strokeWidth: 2, stroke: "#111" }} dot={false} />
        <Area dataKey="plays" type="monotone" stroke="var(--color-plays)" strokeWidth={2} fill="url(#fill-plays)" activeDot={{ r: 4, strokeWidth: 2, stroke: "#111" }} dot={false} />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}
