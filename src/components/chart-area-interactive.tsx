"use client";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { attendanceSeries } from "@/lib/attendanceSeries";
const chartConfig = { count: { label: "Accepted scans", color: "#34d399" } } satisfies ChartConfig;
export function ChartAreaInteractive({ daily = [], hourly = [], loading = false }: { loading?: boolean; daily?: { day: string; count: number }[]; hourly?: { hour: string; count: number }[] }) {
  const [range, setRange] = useState("all");
  const points = useMemo(() => attendanceSeries(daily, hourly, range), [daily, hourly, range]);
  const total = points.reduce((sum, point) => sum + point.count, 0);
  return <Card className="h-full shadow-none"><CardHeader className="gap-3">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Gate activity</CardTitle><CardDescription className="mt-1">{total.toLocaleString()} accepted scans · Kigali time</CardDescription></div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Activity date range">{[["all", "All time"], ["30d", "30 days"], ["7d", "7 days"], ["24h", "24 hours"]].map(([value, label]) => <Button key={value} variant={range === value ? "secondary" : "outline"} size="sm" aria-pressed={range === value} onClick={() => setRange(value)}>{label}</Button>)}</div>
    </div></CardHeader><CardContent>
      {loading ? <Skeleton className="h-72 w-full rounded-xl" /> : total === 0 ? <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center"><CalendarClock className="mb-3 size-8 text-muted-foreground" /><p className="font-medium">No scans in this period</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">Choose All time to review earlier events, or begin checking in attendees at the gate.</p>{range !== "all" && <Button variant="outline" size="sm" className="mt-4" onClick={() => setRange("all")}>View all activity</Button>}</div> :
      <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full"><AreaChart accessibilityLayer data={points} margin={{ left: -16, right: 8, top: 12, bottom: 8 }}>
        <defs><linearGradient id="gateActivityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.35} /><stop offset="95%" stopColor="#34d399" stopOpacity={0.02} /></linearGradient></defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={35} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Area dataKey="count" type="monotone" stroke="#34d399" strokeWidth={2.5} fill="url(#gateActivityFill)" dot={points.length < 3} />
      </AreaChart></ChartContainer>}
    </CardContent></Card>;
}
