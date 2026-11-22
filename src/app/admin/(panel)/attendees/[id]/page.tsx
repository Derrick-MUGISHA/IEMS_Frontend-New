"use client";

import { AdminDetailSkeleton } from "@/components/admin/PageSkeletons";

/* eslint-disable @next/next/no-img-element */
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Mail, Pencil, Phone, Trash2, UserPlus, UserRound, X, CalendarDays, Layers, Users, Calendar, Tag, UserCheck, Save, HeartHandshake, ArrowLeft } from "lucide-react";
import {
  useParticipant,
  useSetRegistrationStatus,
  useDeleteParticipant,
  useRevokePlusOne,
  useAssignPlusOne,
} from "@/hooks/admin/participants";
import { useUpdateGuest } from "@/hooks/admin/guests";
import { adminKeys } from "@/hooks/admin/keys";
import { GUEST_TYPES, GENDERS, RELATIONSHIPS } from "@/types/admin";
import type { ParticipantProfile } from "@/types/admin";
import { ActionMenu } from "@/components/admin/ActionMenu";
import { PageHeader } from "@/components/admin/PageHeader";
import { EventImage } from "@/components/admin/EventImage";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { TicketPanel } from "@/components/admin/TicketPanel";
import { ScanHistory } from "@/components/admin/ScanHistory";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/admin/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ParticipantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isPending, error, refetch } = useParticipant(id);
  const setReg = useSetRegistrationStatus();
  const del = useDeleteParticipant();

  if (isPending) return <AdminDetailSkeleton kind="participant" />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!data)
    return (
      <EmptyState
        title="Participant not found"
        action={
          <Button variant="outline" asChild>
            <Link href="/admin/attendees"><ArrowLeft aria-hidden="true" className="size-4" />Back to participants</Link>
          </Button>
        }
      />
    );

  const p = data.participant;

  return (
    <div>
      <PageHeader
        title={p.name}
        crumbs={[{ label: "Participants", href: "/admin/attendees" }, { label: p.name }]}
        actions={<ActionMenu actions={[
          { label: "Edit participant", icon: <Pencil className="size-4" />, run: () => router.push(`/admin/attendees/${id}/edit`) },
          { label: "Approve", icon: <Check className="size-4" />, disabled: p.registrationStatus === "APPROVED", run: () => setReg.mutateAsync({ id, registrationStatus: "APPROVED" }) },
          { label: "Reject", icon: <X className="size-4" />, disabled: p.registrationStatus === "REJECTED", run: () => setReg.mutateAsync({ id, registrationStatus: "REJECTED" }) },
          { label: "Delete participant", icon: <Trash2 className="size-4" />, confirm: { title: "Delete this participant?", description: "Removes the participant, their plus-one and tickets.", destructive: true }, run: async () => { await del.mutateAsync(id); router.push("/admin/attendees"); } },
        ]} />}
      />

      {p.event && (
        <Link
          href={`/admin/events/${p.event.id}`}
          className="mb-6 block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <EventImage
            thumbnail
            images={p.event.gallery}
            name={p.event.name}
            className="h-48 w-full rounded-none border-0 sm:h-64 lg:h-80"
          />
          <div className="flex items-center gap-3 p-4">
            <CalendarDays className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Registered event</p>
              <p className="font-medium text-foreground">{p.event.name}</p>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-6">
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><UserRound className="size-4" />Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-5 flex items-center gap-4">
                {p.profilePicture ? (
                  <img
                    src={p.profilePicture}
                    alt=""
                    className="size-16 rounded-full border border-border object-cover"
                  />
                ) : (
                  <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UserRound className="size-7" />
                  </span>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge value={p.registrationStatus} />
                  <StatusBadge value={p.status} />
                </div>
              </div>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Row icon={Mail} label="Email" value={p.email.toLowerCase()} />
                <Row icon={Phone} label="Phone" value={p.phone ?? "—"} />
                <Row icon={Layers} label="Stack" value={p.stack ?? "—"} />
                <Row icon={Users} label="Gender" value={p.gender ?? "—"} />
                <Row icon={CalendarDays} label="Event" value={p.event?.name ?? "—"} />
                <Row icon={Calendar} label="Registered" value={new Date(p.registeredAt).toLocaleDateString()} />
              </dl>
            </CardContent>
          </Card>

          <PlusOneCard participantId={id} plusOne={data.plusOne} />

        </div>

        <TicketPanel ticket={data.ticket} name={p.name} event={p.event} type="PARTICIPANT" />
        <ScanHistory history={data.attendance.history} />
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

type PlusOne = NonNullable<ParticipantProfile["plusOne"]>;

/* The plus-one card: shows the guest with Edit + Revoke when one exists, or an
   Assign action when the participant hasn't got one. Revoke + assign together
   give the admin a revoke-then-reassign flow. */
function PlusOneCard({
  participantId,
  plusOne,
}: {
  participantId: string;
  plusOne: PlusOne | null;
}) {
  const revoke = useRevokePlusOne();

  return (
    <Card className="h-full shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="size-4" />Plus one</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="mb-5 flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserPlus aria-hidden="true" className="size-7" />
          </span>
          {plusOne ? (
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge value={plusOne.guestType} />
              <StatusBadge value={plusOne.attendanceStatus} />
            </div>
          ) : (
            <p className="font-medium text-foreground">No plus-one assigned</p>
          )}
        </div>
        {plusOne ? (
          <>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Row icon={UserRound} label="Name" value={plusOne.name} />
              <Row icon={Mail} label="Email" value={plusOne.email.toLowerCase()} />
              <Row icon={Tag} label="Type" value={plusOne.guestType.toLowerCase().replace(/_/g, " ")} />
              <Row icon={UserCheck} label="Attendance" value={plusOne.attendanceStatus.toLowerCase().replace(/_/g, " ")} />
              <Row icon={Calendar} label="Checked in" value={plusOne.checkInTime ? new Date(plusOne.checkInTime).toLocaleString() : "Not checked in"} />
            </dl>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <EditPlusOneDialog participantId={participantId} plusOne={plusOne} />
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" className="text-red-600">
                  <Trash2 className="size-4" />
                  Revoke
                </Button>
              }
              title="Revoke this plus-one?"
              description="Removes the guest, revokes their pass and frees the seat. They'll be emailed that their pass no longer works. You can assign a different plus-one afterwards."
              confirmLabel="Revoke"
              destructive
              onConfirm={async () => {
                await revoke.mutateAsync(participantId);
              }}
            />
          </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-start gap-5">
            <p className="text-sm text-muted-foreground">
              This participant hasn&apos;t invited a plus-one. You can add one on their behalf — a
              guest pass is issued and emailed straight away.
            </p>
            <div className="mt-auto pt-2"><AssignPlusOneDialog participantId={participantId} /></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditPlusOneDialog({
  participantId,
  plusOne,
}: {
  participantId: string;
  plusOne: PlusOne;
}) {
  const qc = useQueryClient();
  const update = useUpdateGuest();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(plusOne.name);
  const [email, setEmail] = useState(plusOne.email);
  const [guestType, setGuestType] = useState(plusOne.guestType);

  async function save() {
    try {
      await update.mutateAsync({ id: plusOne.id, body: { name, email, guestType } });
      await qc.invalidateQueries({ queryKey: adminKeys.participant(participantId) });
      setOpen(false);
    } catch {
      /* the hook toasts the failure; keep the dialog open to retry */
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(plusOne.name);
          setEmail(plusOne.email);
          setGuestType(plusOne.guestType);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil aria-hidden="true" className="size-4" />Edit plus-one</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="po-name"><UserRound aria-hidden="true" className="size-4" />Name</Label>
            <Input id="po-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-email"><Mail aria-hidden="true" className="size-4" />Email</Label>
            <Input
              id="po-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-type"><Tag aria-hidden="true" className="size-4" />Type</Label>
            <Select value={guestType} onValueChange={(v) => setGuestType(v as PlusOne["guestType"])}>
              <SelectTrigger id="po-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GUEST_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={update.isPending}>
            <X aria-hidden="true" className="size-4" />Cancel
          </Button>
          <Button onClick={() => void save()} disabled={update.isPending || name.trim().length < 2}>
            <Save aria-hidden="true" className="size-4" />{update.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignPlusOneDialog({ participantId }: { participantId: string }) {
  const assign = useAssignPlusOne();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [relationship, setRelationship] = useState("");

  function reset() {
    setName("");
    setEmail("");
    setGender("");
    setRelationship("");
  }

  async function submit() {
    try {
      await assign.mutateAsync({
        id: participantId,
        body: {
          name,
          email,
          gender: gender ? (gender as (typeof GENDERS)[number]) : undefined,
          relationship: relationship ? (relationship as (typeof RELATIONSHIPS)[number]) : undefined,
        },
      });
      reset();
      setOpen(false);
    } catch {
      /* the hook toasts the failure; keep the dialog open to retry */
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" />
          Assign plus-one
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus aria-hidden="true" className="size-4" />Assign a plus-one</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="apo-name"><UserRound aria-hidden="true" className="size-4" />Full name</Label>
            <Input id="apo-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apo-email"><Mail aria-hidden="true" className="size-4" />Email</Label>
            <Input
              id="apo-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="apo-gender"><Users aria-hidden="true" className="size-4" />Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="apo-gender" className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apo-relationship"><HeartHandshake aria-hidden="true" className="size-4" />Relationship</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger id="apo-relationship" className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={assign.isPending}>
            <X aria-hidden="true" className="size-4" />Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={assign.isPending || name.trim().length < 2 || !email.trim()}
          >
            <UserPlus aria-hidden="true" className="size-4" />{assign.isPending ? "Adding…" : "Add plus-one"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
