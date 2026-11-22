import type { Metadata } from "next";
import { dbConnect } from "@/lib/db";
import { Ticket } from "@/models";
import { ticketPreview } from "@/lib/ticketPreview";
import { PortalShell, Panel } from "@/components/portal/ui";
import { TicketPdf } from "@/components/portal/TicketPdf";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await dbConnect();
  const ticket = await Ticket.findOne({ code });
  if (!ticket) return (
    <PortalShell eyebrow="Ticket" title="Not found">
      <Panel><p className="text-sm text-cream-dim">This ticket does not exist.</p></Panel>
    </PortalShell>
  );
  const preview = await ticketPreview(ticket);
  return (
    <PortalShell eyebrow="Ticket" title={preview.name} wide>
      <TicketPdf src={`/api/tickets/by-code/${encodeURIComponent(code)}/pdf`}
        preview={preview} revision={`${ticket.code}:${ticket.status}`} filename={`ticket-${ticket.ticketNumber}.pdf`} />
    </PortalShell>
  );
}
