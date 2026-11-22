"use client";

import { AdminListSkeleton } from "@/components/admin/PageSkeletons";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Check, X, Eye, Trash2, UserPlus, Upload, Pencil, Mail } from "lucide-react";
import {
  useParticipants,
  useSetRegistrationStatus,
  useDeleteParticipant,
  useExportParticipants,
  useSendParticipantInvitations,
} from "@/hooks/admin/participants";
import {
  PARTICIPANT_STATUSES,
  REGISTRATION_STATUSES,
  STACKS,
  type AdminParticipant,
} from "@/types/admin";
import { downloadCsv } from "@/lib/tableExport";
import { canSendParticipantInvitation } from "@/lib/participantInvitationEligibility";
import { ActionMenu } from "@/components/admin/ActionMenu";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

/* two-letter monogram for participants without a photo */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

function ParticipantsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [event, setEvent] = useState(params.get("event") ?? "all");
  const [registration, setRegistration] = useState("all");
  const [status, setStatus] = useState("all");
  const [stack, setStack] = useState("all");
  const [plusOne, setPlusOne] = useState("all");

  const filters = {
    event: event === "all" ? undefined : event,
    registrationStatus: registration === "all" ? undefined : registration,
    status: status === "all" ? undefined : status,
    stack: stack === "all" ? undefined : stack,
    plusOne: plusOne === "all" ? undefined : plusOne,
  };
  const { data, isPending, error, refetch } = useParticipants(filters);
  const setReg = useSetRegistrationStatus();
  const del = useDeleteParticipant();
  const exportCsv = useExportParticipants();
  const invitations = useSendParticipantInvitations();

  const columns: Column<AdminParticipant>[] = [
    {
      id: "name",
      header: "Participant",
      sortValue: (p) => p.name.toLowerCase(),
      cell: (p) => (
        <div className="flex items-center gap-3">
          <Avatar>
            {p.profilePicture && <AvatarImage src={p.profilePicture} alt="" />}
            <AvatarFallback>{initials(p.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="min-w-40 break-words font-semibold text-foreground">{p.name}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{p.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "event",
      header: "Event",
      cell: (p) => <span className="text-muted-foreground">{p.event?.name ?? "—"}</span>,
    },
    {
      id: "stack",
      header: "Stack",
      cell: (p) => (
        <span className="text-xs capitalize text-muted-foreground">
          {p.stack ? p.stack.toLowerCase() : "—"}
        </span>
      ),
    },
    { id: "status", header: "Verification", cell: (p) => <StatusBadge value={p.status} /> },
    {
      id: "registration",
      header: "Registration",
      cell: (p) =>
        p.registrationStatus ? (
          <StatusBadge value={p.registrationStatus} />
        ) : (
          <span className="text-xs text-muted-foreground">archived</span>
        ),
    },
    {
      id: "ticket",
      header: "Ticket",
      cell: (p) =>
        p.ticket ? (
          <StatusBadge value={p.ticket.status} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      headerClassName: "w-36",
      cell: (p) => <div onClick={(event) => event.stopPropagation()}><ActionMenu actions={[
        { label: "View participant", icon: <Eye className="size-4" />, run: () => router.push(p.registrationStatus ? `/admin/attendees/${p.id}` : `/admin/tickets/${p.ticket?.id ?? p.id}`) },
        ...(p.registrationStatus ? [
          { label: "Edit participant", icon: <Pencil className="size-4" />, run: () => router.push(`/admin/attendees/${p.id}/edit`) },
          ...(canSendParticipantInvitation(p) ? [{ label: "Send invitation", icon: <Mail className="size-4" />, disabled: invitations.isPending, run: () => invitations.mutateAsync([p.id]) }] : []),
          { label: "Approve", icon: <Check className="size-4" />, disabled: p.registrationStatus === "APPROVED", run: () => setReg.mutateAsync({ id: p.id, registrationStatus: "APPROVED" }) },
          { label: "Reject", icon: <X className="size-4" />, disabled: p.registrationStatus === "REJECTED", run: () => setReg.mutateAsync({ id: p.id, registrationStatus: "REJECTED" }) },
          { label: "Delete participant", icon: <Trash2 className="size-4" />, confirm: { title: "Delete this participant?", description: "Removes their registration, plus-one and tickets.", destructive: true }, run: () => del.mutateAsync(p.id) },
        ] : []),
      ]} /></div>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Participants"
        description="Everyone registered across your events — approve, edit or export."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => exportCsv.mutate(event === "all" ? undefined : event)}
              disabled={exportCsv.isPending}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
            <Button variant="outline" asChild><Link href="/admin/attendees/import"><Upload />Import CSV / paste</Link></Button>
            <Button asChild>
              <Link href="/admin/attendees/new">
                <UserPlus className="size-4" />
                Add participant
              </Link>
            </Button>
          </>
        }
      />

      {!!invitations.data?.failed.length && <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p>{invitations.data.failed.length} invitations failed. {invitations.data.failed[0].error}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" disabled={invitations.isPending} onClick={() => invitations.mutate(invitations.data!.failed.map((item) => item.id))}>Retry failed invitations</Button>
      </div>}

      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : (
        <DataTable
          loading={isPending}
          data={data ?? []}
          columns={columns}
          getRowId={(p) => p.id}
          onRowClick={(p) => router.push(p.registrationStatus ? `/admin/attendees/${p.id}` : `/admin/tickets/${p.ticket?.id ?? p.id}`)}
          searchable={(p) => `${p.name} ${p.email} ${p.phone ?? ""}`}
          searchPlaceholder="Search participants…"
          pageSize={25}
          selectionActions={(selected) => <>
            <Button variant="outline" size="sm" disabled={invitations.isPending || !selected.some(canSendParticipantInvitation)} onClick={() => invitations.mutate(selected.filter(canSendParticipantInvitation).map((p) => p.id))}><Mail />{invitations.isPending ? "Sending invitations…" : `Invite unverified (${selected.filter(canSendParticipantInvitation).length})`}</Button>
            <Button variant="outline" size="sm" onClick={() => downloadCsv("selected-participants.csv", ["Name", "Email", "Phone", "Event", "Registration", "Ticket"], selected.map((person) => [person.name, person.email, person.phone, person.event?.name, person.registrationStatus ?? "Archived", person.ticket?.status]))}><Download />Export selected</Button>
          </>}
          toolbar={
            <>
              {(event !== "all" || registration !== "all" || status !== "all" || stack !== "all" || plusOne !== "all") && <Button variant="outline" size="sm" onClick={() => { setEvent("all"); setRegistration("all"); setStatus("all"); setStack("all"); setPlusOne("all"); }}><X />Clear filters</Button>}
              <EventPicker
                value={event}
                onValueChange={setEvent}
                includeAll
                className="h-9 w-42.5"
              />


              <Select value={registration} onValueChange={setRegistration}>
                <SelectTrigger className="h-9 w-37.5">
                  <SelectValue placeholder="Registration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All registrations</SelectItem>
                  {REGISTRATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-35">
                  <SelectValue placeholder="Verification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {PARTICIPANT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stack} onValueChange={setStack}>
                <SelectTrigger className="h-9 w-32.5">
                  <SelectValue placeholder="Stack" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stacks</SelectItem>
                  {STACKS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={plusOne} onValueChange={setPlusOne}>
                <SelectTrigger className="h-9 w-37.5">
                  <SelectValue placeholder="Plus-one" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any plus-one</SelectItem>
                  <SelectItem value="none">No plus-one</SelectItem>
                  <SelectItem value="has">Has plus-one</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
        />
      )}
    </div>
  );
}

export default function ParticipantsPage() {
  return (
    <Suspense fallback={<AdminListSkeleton kind="participants" />}>
      <ParticipantsInner />
    </Suspense>
  );
}
