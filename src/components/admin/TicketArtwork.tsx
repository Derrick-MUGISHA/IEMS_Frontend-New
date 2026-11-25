/* eslint-disable @next/next/no-img-element */
import { QrCode } from "lucide-react";
import { formatEventDate, formatEventTime } from "@/lib/time";
export type TicketArtworkData = { name: string; type?: string; eventName: string; date?: string | null; venue?: string | null; images?: string[]; organiser?: string; subtitle?: string; price?: string; number?: string; status?: string; qr?: string };
export function TicketArtworkSkeleton() {
  return <div className="ticket-artwork animate-pulse" style={{ background: "var(--panel-2)" }} aria-hidden="true">
    <div className="ticket-artwork-content">
      <div className="ticket-artwork-top"><div className="space-y-3"><div className="h-2 w-1/3 rounded bg-cream/10" /><div className="h-7 w-4/5 rounded bg-cream/10" /><div className="h-3 w-1/2 rounded bg-cream/10" /></div><div className="aspect-square rounded bg-cream/10" /></div>
      <div className="ticket-artwork-meta">{[0, 1, 2].map((key) => <div key={key} className="space-y-2"><div className="h-2 w-1/3 rounded bg-cream/10" /><div className="h-3 w-4/5 rounded bg-cream/10" /></div>)}</div>
      <div className="ticket-artwork-bottom">{[0, 1, 2, 3, 4].map((key) => <div key={key} className="h-4 rounded bg-cream/10" />)}</div>
      <div className="h-2 w-2/3 rounded bg-cream/10" />
    </div>
  </div>;
}
export function TicketArtwork({ ticket }: { ticket: TicketArtworkData }) {
  const text = ticket.subtitle?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return <div className="ticket-artwork" aria-label={`${ticket.name}'s ticket preview`}>
    {ticket.images?.[0] && <img className="ticket-artwork-bg" src={ticket.images[0]} alt="" />}
    <div className="ticket-artwork-paper" />
    <div className="ticket-artwork-content">
      <div className="ticket-artwork-top"><div><p className="ticket-artwork-label">{ticket.organiser || "Igire Rwanda Organization"}</p><h3>{ticket.eventName}</h3><p className="ticket-artwork-description">{text || "Present your ticket at the entrance."}</p></div>
        <div className="ticket-artwork-qr">{ticket.qr ? <img src={ticket.qr} alt="Signed ticket entry QR" /> : <><QrCode /><span>DESIGN PREVIEW</span></>}</div></div>
      <div className="ticket-artwork-meta"><div><p className="ticket-artwork-label">Date</p><strong>{ticket.date ? formatEventDate(ticket.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "Date to be confirmed"}</strong><p>{ticket.date ? `Starts ${formatEventTime(ticket.date)} (Kigali)` : ""}</p></div><div><p className="ticket-artwork-label">Venue</p><strong>{ticket.venue || "To be confirmed"}</strong><p>Present this ticket at the entrance</p></div><div><p className="ticket-artwork-label">Entry code</p><strong>{ticket.number || "SAMPLE"}</strong></div></div>
      <div className="ticket-artwork-bottom"><div><p className="ticket-artwork-label">Ticket holder</p><strong>{ticket.name}</strong></div><div><p className="ticket-artwork-label">Section</p><strong>General</strong></div><div><p className="ticket-artwork-label">Row</p><strong>—</strong></div><div><p className="ticket-artwork-label">Seat</p><strong>Open</strong></div><div><p className="ticket-artwork-label">{ticket.type || "Participant"}</p><strong>{ticket.price || "Free"}</strong></div></div>
      <p className="ticket-artwork-footnote">{ticket.qr ? `${ticket.status || "VALID"} · Admits one. Scan the code at the door, on paper or on screen. Keep your entry code private.` : "Sample layout only. This preview cannot be used for entry."}</p>
    </div>
  </div>;
}
