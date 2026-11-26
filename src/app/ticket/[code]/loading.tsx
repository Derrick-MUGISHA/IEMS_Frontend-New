import { PortalShell, SkeletonBar } from "@/components/portal/ui";
import { TicketSkeleton } from "@/components/portal/TicketPdf";
export default function LoadingTicket() {
  return <PortalShell eyebrow="Ticket" title="Your ticket" wide><TicketSkeleton /><SkeletonBar className="mx-auto mt-3 h-3 w-2/3" /></PortalShell>;
}
