"use client";

import { AdminDetailSkeleton } from "@/components/admin/PageSkeletons";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, QrCode, RotateCcw, Send, Trash2 } from "lucide-react";
import { TicketPanel } from "@/components/admin/TicketPanel";
import { ActionMenu } from "@/components/admin/ActionMenu";
import { formatEventDateTime } from "@/lib/time";
import { useTicket, useTicketAction, useRegenerateQr } from "@/hooks/admin/tickets";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ScanHistory } from "@/components/admin/ScanHistory";
import { EmptyState, ErrorState } from "@/components/admin/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isPending, error, refetch } = useTicket(id);
  const action = useTicketAction();
  const regenerate = useRegenerateQr();

  if (isPending) return <AdminDetailSkeleton kind="ticket" />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!data)
    return (
      <EmptyState
        title="Ticket not found"
        action={
          <Button variant="outline" asChild>
            <Link href="/admin/tickets">Back to tickets</Link>
          </Button>
        }
      />
    );

  const t = data.ticket;

  return (
    <div>
      <PageHeader
        title={t.ticketNumber}
        crumbs={[{ label: "Tickets", href: "/admin/tickets" }, { label: t.ticketNumber }]}
        actions={<ActionMenu actions={[
          { label: "Resend ticket", icon: <Send className="size-4" />, run: () => action.mutateAsync({ id, action: "resend" }) },
          { label: "Replace QR", icon: <QrCode className="size-4" />, disabled: t.status !== "VALID", confirm: { title: "Replace this QR?", description: "The old QR stops working. Download or resend the updated ticket." }, run: () => regenerate.mutateAsync(id) },
          { label: "Reset ticket", icon: <RotateCcw className="size-4" />, disabled: t.status !== "VALID", confirm: { title: "Reset this ticket?", description: "The old QR stops working and a new ticket is emailed." }, run: () => action.mutateAsync({ id, action: "reset" }) },
          { label: "Revoke ticket", icon: <Ban className="size-4" />, disabled: t.status === "REVOKED", confirm: { title: "Revoke this ticket?", description: "Invalidates the ticket and frees the seat.", destructive: true }, run: () => action.mutateAsync({ id, action: "revoke" }) },
          { label: "Delete ticket", icon: <Trash2 className="size-4" />, confirm: { title: "Delete this ticket?", description: "Permanently removes the ticket record.", destructive: true }, run: async () => { await action.mutateAsync({ id, action: "delete" }); router.push("/admin/tickets"); } },
        ]} />}
      />

      <section className="mb-6 space-y-4" aria-labelledby="ticket-preview-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="ticket-preview-title" className="text-lg font-semibold">Ticket</h2>
            <p className="text-sm text-muted-foreground">
              Review the PDF your attendee downloads and receives by email. Previewing does not check them in.
            </p>
          </div>
        </div>
        <TicketPanel ticket={{ ...t, sentAt: t.sentAt ?? null, qrDataUrl: t.qrDataUrl ?? "" }} name={t.participantName} type={t.holderType} event={{ name: t.eventName ?? "Event", startTime: t.eventDate ?? undefined, endTime: t.expiresAt ?? undefined, location: t.venue ?? undefined, gallery: t.gallery, organiser: t.organiser, details: t.subtitle, price: t.price }} />
        <p className="text-sm text-muted-foreground">
          {t.expiresAt ? `Entry closes ${formatEventDateTime(t.expiresAt)} (Kigali). ` : ""}
          Share the ticket only with its holder.
        </p>
      </section>

      <div className="space-y-6">
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Holder</CardTitle>
              <StatusBadge value={t.status} />
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Row label="Name" value={t.participantName} />
                <Row label="Owner type" value={t.ownerType} />
                <Row label="Event" value={t.eventName ?? "—"} />
                <Row label="Issued" value={new Date(t.registeredAt).toLocaleString()} />
                <Row
                  label="Checked in"
                  value={t.scannedAt ? new Date(t.scannedAt).toLocaleString() : "—"}
                />
                <Row
                  label="Cancelled"
                  value={t.cancelledAt ? new Date(t.cancelledAt).toLocaleString() : "—"}
                />
              </dl>
            </CardContent>
          </Card>

          <ScanHistory history={data.history} />
        </div>

      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
