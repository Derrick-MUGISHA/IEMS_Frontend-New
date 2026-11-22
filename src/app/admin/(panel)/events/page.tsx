"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, CalendarRange, Eye, Pencil, Download, X } from "lucide-react";
import { useEvents } from "@/hooks/admin/events";
import { EVENT_CATEGORIES, EVENT_STATUSES, type AdminEvent } from "@/types/admin";
import { EventImage } from "@/components/admin/EventImage";
import { ActionMenu } from "@/components/admin/ActionMenu";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EmptyState, ErrorState } from "@/components/admin/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { downloadCsv } from "@/lib/tableExport";
import { formatEventDate } from "@/lib/time";

/* event dates always render in Kigali time, matching what the admin typed */
const dateFmt = (s: string) => formatEventDate(s, { month: "short", day: "numeric", year: "numeric" });

export default function EventsPage() {
  const router = useRouter();
  const { data, isPending, error, refetch } = useEvents();
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");

  const rows = useMemo(() => {
    let list = data ?? [];
    if (status !== "all") list = list.filter((e) => e.status === status);
    if (category !== "all") list = list.filter((e) => e.category === category);
    return list;
  }, [data, status, category]);

  const columns: Column<AdminEvent>[] = [
    {
      id: "name",
      header: "Event",
      sortValue: (e) => e.name.toLowerCase(),
      cell: (e) => (
        <div className="flex items-center gap-3">
          <EventImage thumbnail images={e.gallery} name={e.name} className="size-[50px]" />
          <div className="min-w-0">
            <p className="max-w-sm break-words font-semibold text-foreground">{e.name}</p>
            <p className="mt-1 max-w-sm break-words text-xs text-muted-foreground">{e.location || "—"}</p>
          </div>
        </div>
      ),
    },
    { id: "category", header: "Category", sortValue: (e) => e.category, cell: (e) => e.category },
    {
      id: "type",
      header: "Type",
      cell: (e) => (
        <span className="text-xs capitalize text-muted-foreground">{e.type.toLowerCase()}</span>
      ),
    },
    {
      id: "start",
      header: "Starts",
      sortValue: (e) => e.startTime,
      cell: (e) => <span className="tabular-nums">{dateFmt(e.startTime)}</span>,
    },
    {
      id: "capacity",
      header: "Capacity",
      sortValue: (e) => e.maxAttendees,
      cell: (e) => <div className="min-w-28 space-y-1.5"><p className="text-sm tabular-nums">{e.registeredCount ?? 0} <span className="text-muted-foreground">/ {e.maxAttendees || "Unlimited"}</span></p>{e.maxAttendees > 0 && <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, ((e.registeredCount ?? 0) / e.maxAttendees) * 100)}%` }} /></div>}</div>,
    },
    {
      id: "status",
      header: "Status",
      cell: (e) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge value={e.status} />
          {!e.isPublished && (
            <Badge variant="outline" className="rounded-full px-2 py-0 text-[11px] text-muted-foreground">
              Unpublished
            </Badge>
          )}
        </div>
      ),
    },
    { id: "actions", header: "Actions", cell: (event) => <div onClick={(e) => e.stopPropagation()}><ActionMenu actions={[
      { label: "View event", icon: <Eye className="size-4" />, run: () => router.push(`/admin/events/${event.id}`) },
      { label: "Edit event", icon: <Pencil className="size-4" />, run: () => router.push(`/admin/events/${event.id}/edit`) },
    ]} /></div> },
  ];

  return (
    <div>
      <PageHeader
        title="Events"
        description="Create and manage every event — tickets expire when an event ends."
        actions={
          <Button asChild>
            <Link href="/admin/events/new">
              <CalendarPlus className="size-4" />
              New event
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[{ label: "All events", value: data?.length ?? 0 }, { label: "Registration open", value: data?.filter((event) => event.status === "OPEN").length ?? 0 }, { label: "Published on calendar", value: data?.filter((event) => event.isPublished).length ?? 0 }].map((item) => <div key={item.label} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</p></div>)}
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : !isPending && (data ?? []).length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="size-5" />}
          title="No events yet"
          message="Create your first event to start issuing tickets."
          action={
            <Button asChild>
              <Link href="/admin/events/new">
                <CalendarPlus className="size-4" />
                New event
              </Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          loading={isPending}
          data={rows}
          columns={columns}
          getRowId={(e) => e.id}
          onRowClick={(e) => router.push(`/admin/events/${e.id}`)}
          searchable={(e) => `${e.name} ${e.location} ${e.slug}`}
          searchPlaceholder="Search by event name or venue…"
          selectionActions={(selected) => <Button size="sm" variant="outline" onClick={() => downloadCsv("selected-events.csv", ["Event", "Venue", "Starts", "Status", "Capacity"], selected.map((event) => [event.name, event.location, event.startTime, event.status, event.maxAttendees]))}><Download />Export selected</Button>}
          toolbar={
            <>
              {(status !== "all" || category !== "all") && <Button variant="outline" size="sm" onClick={() => { setStatus("all"); setCategory("all"); }}><X />Clear filters</Button>}
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-32.5">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {EVENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 w-42.5">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {EVENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />
      )}
    </div>
  );
}
