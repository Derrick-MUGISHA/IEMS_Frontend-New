"use client";

import { AdminDetailSkeleton } from "@/components/admin/PageSkeletons";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Pencil, Trash2, UserRound, CalendarDays, Calendar, UserPlus } from "lucide-react";
import { useGuest, useDeleteGuest } from "@/hooks/admin/guests";
import { ActionMenu } from "@/components/admin/ActionMenu";
import { PageHeader } from "@/components/admin/PageHeader";
import { EventImage } from "@/components/admin/EventImage";
import { TicketPanel } from "@/components/admin/TicketPanel";
import { ScanHistory } from "@/components/admin/ScanHistory";
import { EmptyState } from "@/components/admin/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isPending, error } = useGuest(id);
  const del = useDeleteGuest();

  if (isPending) return <AdminDetailSkeleton kind="guest" />;
  if (error || !data)
    return (
      <EmptyState
        title="Guest not found"
        action={
          <Button variant="outline" asChild>
            <Link href="/admin/guests">Back to guests</Link>
          </Button>
        }
      />
    );

  const g = data.guest;

  return (
    <div>
      <PageHeader
        title={g.name}
        crumbs={[{ label: "Guests", href: "/admin/guests" }, { label: g.name }]}
        actions={<ActionMenu actions={[
          { label: "Edit guest", icon: <Pencil className="size-4" />, run: () => router.push(`/admin/guests/${id}/edit`) },
          { label: "Delete guest", icon: <Trash2 className="size-4" />, confirm: { title: "Delete this guest?", description: "Removes the guest and their ticket, and frees the seat.", destructive: true }, run: async () => { await del.mutateAsync(id); router.push("/admin/guests"); } },
        ]} />}
      />

      {g.event && (
        <Link
          href={`/admin/events/${g.event.id}`}
          className="mb-6 block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <EventImage
            thumbnail
            images={g.event.gallery}
            name={g.event.name}
            className="h-48 w-full rounded-none border-0 sm:h-64 lg:h-80"
          />
          <div className="flex items-center gap-3 p-4">
            <CalendarDays className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Registered event</p>
              <p className="font-medium text-foreground">{g.event.name}</p>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><UserRound className="size-4" />Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-5 flex items-center gap-4">
                <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <UserRound className="size-7" />
                </span>
                <Badge variant="outline" className="rounded-full capitalize">
                  {g.guestType.toLowerCase().replace(/_/g, " ")}
                </Badge>
              </div>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Row icon={Mail} label="Email" value={g.email.toLowerCase()} />
                <Row icon={CalendarDays} label="Event" value={g.event?.name ?? "—"} />
                <Row icon={UserPlus} label="Invited by" value={g.inviter?.name ?? "Admin"} />
                <Row icon={Calendar} label="Added" value={new Date(g.registeredAt).toLocaleDateString()} />
              </dl>
            </CardContent>
          </Card>


        </div>

        <TicketPanel ticket={data.ticket} name={g.name} event={g.event} type={g.guestType} />
        <ScanHistory history={data.attendance.history} />
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon?: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}
