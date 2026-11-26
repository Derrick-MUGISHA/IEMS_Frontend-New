"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, Users, UserRound, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { useParticipants } from "@/hooks/admin/participants";
import { useGuests } from "@/hooks/admin/guests";
import { useGenerateTicket } from "@/hooks/admin/tickets";
import { PageHeader } from "@/components/admin/PageHeader";
import { SearchSelect, type Choice } from "@/components/admin/SearchSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/admin/states";
export default function GenerateTicketPage() {
  const router = useRouter(); const generate = useGenerateTicket();
  const participants = useParticipants(); const guests = useGuests();
  const [participantId, setParticipantId] = useState(""); const [guestId, setGuestId] = useState("");
  const pOptions: Choice[] = (participants.data ?? []).filter((p) => p.registrationStatus && p.registrationStatus !== "REJECTED").map((p) => ({ value: p.id, label: p.name, description: `${p.email.toLowerCase()} · ${p.event?.name ?? ""}${p.ticket ? " · Ticket already issued" : ""}` }));
  const gOptions: Choice[] = (guests.data ?? []).map((g) => ({ value: g.id, label: g.name, description: `${g.email.toLowerCase()} · ${g.eventName ?? ""}${g.ticket ? " · Ticket already issued" : ""}` }));
  async function submit(kind: "participant" | "guest") {
    try { const result = await generate.mutateAsync(kind === "participant" ? { participantId } : { guestId }); router.push(`/admin/tickets/${result.ticket.id}`); } catch { /* Mutation errors keep the current selection for retry. */ }
  }
  return <div className="space-y-6"><PageHeader title="Generate ticket" description="Choose a registered participant or guest. Their PDF ticket is generated and emailed." crumbs={[{ label: "Tickets", href: "/admin/tickets" }, { label: "Generate" }]} actions={<Button variant="outline" onClick={() => router.push("/admin/tickets")}><ArrowLeft className="size-4" />Back to tickets</Button>} />
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="size-5" />Ticket recipient</CardTitle><CardDescription>Search by name, email or event.</CardDescription></CardHeader><CardContent>
      <Tabs defaultValue="participant" className="ticket-recipient-tabs"><TabsList className="mb-6 grid h-12 w-full grid-cols-2"><TabsTrigger value="participant" className="h-10 gap-2"><Users className="size-4" />Participant</TabsTrigger><TabsTrigger value="guest" className="h-10 gap-2"><UserRound className="size-4" />Guest</TabsTrigger></TabsList>
        {(["participant", "guest"] as const).map((kind) => { const query = kind === "participant" ? participants : guests; const value = kind === "participant" ? participantId : guestId; return <TabsContent key={kind} value={kind} className="space-y-5">
          {query.error ? <ErrorState message={query.error.message} onRetry={() => query.refetch()} /> : <>
            <SearchSelect options={kind === "participant" ? pOptions : gOptions} value={value} onChange={kind === "participant" ? setParticipantId : setGuestId} label={kind === "participant" ? "Participant" : "Guest"} placeholder={query.isPending ? "Loading recipients…" : `Choose a ${kind}`} disabled={generate.isPending || query.isPending} className="w-full" />
            <div className="flex justify-end border-t border-border pt-5"><Button disabled={!value || generate.isPending} onClick={() => submit(kind)}>{generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Ticket className="size-4" />}{generate.isPending ? "Generating…" : "Generate and email ticket"}</Button></div>
          </>}
        </TabsContent>; })}
      </Tabs>
    </CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Mail className="size-4" />What happens next</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>One PDF ticket is created with the event artwork and a signed entry QR.</p><p>The recipient receives it by email. You’ll open the ticket’s management page to review it.</p><p>If a ticket already exists, its existing record is returned.</p></CardContent></Card></div>
  </div>;
}
