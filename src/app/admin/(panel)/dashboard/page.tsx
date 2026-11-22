"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Users,
  Ticket,
  UserCheck,
  TrendingUp,
  RefreshCw,
  Plus,
  Eye,
  ScanLine,
} from "lucide-react";
import { useDashboard, useEventStats } from "@/hooks/admin/dashboard";
import { PageHeader } from "@/components/admin/PageHeader";
import { EventImage } from "@/components/admin/EventImage";
import { EventPicker } from "@/components/admin/EventPicker";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { SystemHealth } from "@/components/admin/SystemHealth";
import { ErrorState } from "@/components/admin/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { EventStat } from "@/types/admin";
import { formatEventDate } from "@/lib/time";

export default function DashboardPage() {
  const [event, setEvent] = useState("all");
  const dash = useDashboard(event === "all" ? undefined : event);
  const stats = useEventStats();
  if (dash.error || stats.error)
    return (
      <ErrorState
        message={(dash.error ?? stats.error)!.message}
        onRetry={() => {
          dash.refetch();
          stats.refetch();
        }}
      />
    );
  const rows = (stats.data?.stats ?? []).filter(
    (row) => event === "all" || row.event.id === event,
  );
  const sum = (value: (row: EventStat) => number) =>
    rows.reduce((total, row) => total + value(row), 0);
  const registered = sum((row) => row.totalAttendees),
    issued = sum((row) => row.fullness.issued),
    checked = sum((row) => row.checkedIn);
  const pending = sum((row) => row.ticketsPending);
  const rate = issued ? Math.round((checked / issued) * 100) : null;
  const loading = dash.isPending || stats.isPending;
  const columns: Column<EventStat>[] = [
    {
      id: "event",
      header: "Event",
      sortValue: (row) => row.event.name,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <EventImage
              thumbnail
            images={row.event.gallery}
            name={row.event.name}
            className="size-[50px]"
          />
          <div>
            <Link
              className="font-semibold hover:underline"
              href={`/admin/events/${row.event.id}`}
            >
              {row.event.name}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatEventDate(row.event.startTime, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              · {row.event.location}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "people",
      header: "Registered",
      sortValue: (row) => row.totalAttendees,
      cell: (row) => row.totalAttendees,
    },
    {
      id: "issued",
      header: "Issued tickets",
      sortValue: (row) => row.fullness.issued,
      cell: (row) => row.fullness.issued,
    },
    {
      id: "checkins",
      header: "Checked in",
      sortValue: (row) => row.checkedIn,
      cell: (row) => row.checkedIn,
    },
    {
      id: "attendance",
      header: "Attendance",
      sortValue: (row) => row.attendancePercentage,
      cell: (row) => (
        <div className="min-w-24">
          <p className="mb-1.5 text-sm tabular-nums">
            {row.fullness.issued
              ? `${row.attendancePercentage}%`
              : "No tickets yet"}
          </p>
          <div className="h-1.5 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${row.attendancePercentage}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge value={row.event.status} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <Button size="sm" variant="outline" asChild>
          <Link href={`/admin/events/${row.event.id}`}>
            <Eye />
            View event
          </Link>
        </Button>
      ),
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Event overview"
        description="Registration, ticket delivery and attendance in one place. All event times use Kigali time."
        actions={
          <>
            <Button
              variant="outline"
              disabled={dash.isFetching || stats.isFetching}
              onClick={() => {
                dash.refetch();
                stats.refetch();
              }}
            >
              <RefreshCw className={dash.isFetching ? "animate-spin" : ""} />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/admin/events/new">
                <Plus />
                Create event
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid items-center gap-x-8 gap-y-3 rounded-xl border border-border bg-card/50 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="w-full min-w-0 max-w-md [&>*]:w-full">
        <EventPicker
          value={event}
          onValueChange={setEvent}
          includeAll
          className="w-full min-w-0"
        />
        </div>
        <p className="justify-self-end whitespace-nowrap text-right text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "event" : "events"} in this
          overview
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Registered people"
          value={registered.toLocaleString()}
          hint="Participants and invited guests"
          loading={loading}
          tone="blue"
        />
        <StatCard
          icon={Ticket}
          label="Issued tickets"
          value={issued.toLocaleString()}
          hint="Valid and checked-in tickets"
          loading={loading}
          tone="orange"
        />
        <StatCard
          icon={UserCheck}
          label="Checked-in tickets"
          value={checked.toLocaleString()}
          hint="Unique tickets used at the gate"
          loading={loading}
          tone="green"
        />
        <StatCard
          icon={TrendingUp}
          label="Attendance rate"
          value={rate === null ? "—" : `${rate}%`}
          hint="Checked in / issued tickets"
          loading={loading}
          tone="zinc"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ChartAreaInteractive
          loading={dash.isPending}
          daily={dash.data?.attendance.dailyCheckins}
          hourly={dash.data?.attendance.hourlyCheckins}
        />
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Registration & entry</CardTitle>
            <CardDescription>
              Counts from registrations and issued tickets. Historical ticket
              holders are included.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { label: "Registered people", value: registered },
              { label: "Tickets issued", value: issued },
              { label: "Checked in", value: checked },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <strong className="tabular-nums">{item.value}</strong>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-emerald-400/80"
                    style={{
                      width: `${registered ? Math.min(100, (item.value / Math.max(registered, issued)) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {pending} issued tickets have not been emailed.
              </p>
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <Link href="/admin/emails">Manage ticket delivery</Link>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <Link href="/admin/scan">
                  <ScanLine />
                  Open gate scanner
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Event performance</h2>
          <p className="text-sm text-muted-foreground">
            Compare each event and open its actual management page.
          </p>
        </div>
        <DataTable
            loading={stats.isPending}
            data={rows}
            getRowId={(row) => row.event.id}
            columns={columns}
            searchable={(row) => `${row.event.name} ${row.event.location}`}
            searchPlaceholder="Find an event…"
          />
      </section>
      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          System health & operational status
        </summary>
        <div className="mt-5">
          <SystemHealth />
        </div>
      </details>
    </div>
  );
}
