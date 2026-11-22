"use client";
import Link from "next/link";
import { useState } from "react";
import { Download, Loader2, MailCheck, Settings2, Ticket as TicketIcon } from "lucide-react";
import { endOfEventDay } from "@/lib/time";
import { apiBlob } from "@/lib/client";
import { TicketArtwork } from "./TicketArtwork";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
type Event = { name: string; startTime?: string; endTime?: string; location?: string; gallery?: string[]; organiser?: string; details?: string; price?: string };
type TicketLike = { id: string; ticketNumber: string; status: string; sentAt: string | null; scannedAt: string | null; qrDataUrl: string };
export function TicketPanel({ ticket, name, event, type }: { ticket: TicketLike | null; name: string; event?: Event | null; type?: string }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function download() {
    if (!ticket) return; setBusy(true); setError("");
    try { const blob = await apiBlob(`/api/tickets/${ticket.id}/download`, { role: "admin" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `ticket-${ticket.ticketNumber}.pdf`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Download failed"); } finally { setBusy(false); }
  }
  const deadline = event?.endTime ? new Date(event.endTime) : event?.startTime ? endOfEventDay(event.startTime) : null;
  const status = ticket?.status === "VALID" && deadline && new Date() > deadline ? "EXPIRED" : ticket?.status;
  return <Card className="shadow-none"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-base"><TicketIcon className="size-4" />Ticket</CardTitle>{ticket && <StatusBadge value={status ?? ticket.status} />}</CardHeader><CardContent className="space-y-4">
    {!ticket ? <p className="py-4 text-sm text-muted-foreground">No ticket issued yet.</p> : <>
      <TicketArtwork ticket={{ name, type, eventName: event?.name ?? "Event", date: event?.startTime, venue: event?.location, images: event?.gallery, organiser: event?.organiser, subtitle: event?.details, price: event?.price, number: ticket.ticketNumber, status, qr: ticket.qrDataUrl }} />
      <div className="flex flex-wrap items-center gap-3"><Button onClick={download} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Download PDF</Button><Button variant="outline" asChild><Link href={`/admin/tickets/${ticket.id}`}><Settings2 className="size-4" />Manage ticket</Link></Button><span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground"><MailCheck className="size-4" />{ticket.sentAt ? "Emailed" : "Not emailed"}</span></div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </>}
  </CardContent></Card>;
}
