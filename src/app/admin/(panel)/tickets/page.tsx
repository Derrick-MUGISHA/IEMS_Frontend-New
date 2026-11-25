"use client";

import { AdminListSkeleton } from "@/components/admin/PageSkeletons";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, RotateCcw, Send, Ticket as TicketIcon, Trash2, Ban } from "lucide-react";
import { useTickets, useTicketAction } from "@/hooks/admin/tickets";
import { TICKET_STATUSES, type AdminTicket } from "@/types/admin";
import { ActionMenu } from "@/components/admin/ActionMenu";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { EventPicker } from "@/components/admin/EventPicker";
import { ErrorState } from "@/components/admin/states";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function TicketsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [event, setEvent] = useState(params.get("event") ?? "all");
  const [status, setStatus] = useState("all");

  const { data, isPending, error, refetch } = useTickets({
    event: event === "all" ? undefined : event,
    status: status === "all" ? undefined : status,
  });
  const action = useTicketAction();

  const columns: Column<AdminTicket>[] = [
    {
      id: "number",
      header: "Ticket",
      sortValue: (t) => t.ticketNumber,
      cell: (t) => (
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
          {t.ticketNumber}
        </span>
      ),
    },
    {
      id: "holder",
      header: "Holder",
      sortValue: (t) => t.participantName.toLowerCase(),
      cell: (t) => (
        <div>
          <p className="font-medium text-foreground">{t.participantName}</p>
          <p className="text-xs text-muted-foreground">{t.ownerType}</p>
        </div>
      ),
    },
    {
      id: "event",
      header: "Event",
      cell: (t) => <span className="text-muted-foreground">{t.eventName ?? "—"}</span>,
    },
    { id: "status", header: "Status", cell: (t) => <StatusBadge value={t.status} /> },
    {
      id: "sent",
      header: "Issued",
      sortValue: (t) => t.registeredAt,
      cell: (t) => (
        <span className="tabular-nums text-muted-foreground">
          {new Date(t.registeredAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      headerClassName: "w-52",
      cell: (t) => <div onClick={(event) => event.stopPropagation()}><ActionMenu actions={[
        { label: "View ticket", icon: <Eye className="size-4" />, run: () => router.push(`/admin/tickets/${t.id}`) },
        { label: "Resend email", icon: <Send className="size-4" />, run: () => action.mutateAsync({ id: t.id, action: "resend" }) },
        { label: "Reset ticket", icon: <RotateCcw className="size-4" />, disabled: t.status !== "VALID", confirm: { title: "Reset this ticket?", description: "The old QR stops working and a new ticket is emailed." }, run: () => action.mutateAsync({ id: t.id, action: "reset" }) },
        { label: "Revoke ticket", icon: <Ban className="size-4" />, disabled: t.status === "REVOKED", confirm: { title: "Revoke this ticket?", description: "Invalidates the ticket and frees the seat.", destructive: true }, run: () => action.mutateAsync({ id: t.id, action: "revoke" }) },
        { label: "Delete ticket", icon: <Trash2 className="size-4" />, confirm: { title: "Delete this ticket?", description: "Permanently removes the ticket record.", destructive: true }, run: () => action.mutateAsync({ id: t.id, action: "delete" }) },
      ]} /></div>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tickets"
        description="Every issued pass — resend, reset, revoke or generate new ones."
        actions={
          <Button asChild>
            <Link href="/admin/tickets/new">
              <TicketIcon className="size-4" />
              Generate ticket
            </Link>
          </Button>
        }
      />

      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : (
        <DataTable
          loading={isPending}
          data={data ?? []}
          columns={columns}
          getRowId={(t) => t.id}
          onRowClick={(t) => router.push(`/admin/tickets/${t.id}`)}
          searchable={(t) => `${t.ticketNumber} ${t.participantName} ${t.eventName ?? ""}`}
          searchPlaceholder="Search by number or holder…"
          pageSize={12}
          toolbar={
            <>
              <EventPicker value={event} onValueChange={setEvent} includeAll className="h-9 w-42.5" />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-32.5">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
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

export default function TicketsPage() {
  return (
    <Suspense fallback={<AdminListSkeleton kind="tickets" />}>
      <TicketsInner />
    </Suspense>
  );
}
