import { DataTable } from "./DataTable";
import { PageHeader } from "./PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TicketArtworkSkeleton } from "./TicketArtwork";

function Header({ actions = true }: { actions?: boolean }) {
  return <div className="mb-6 space-y-3"><Skeleton className="h-4 w-48" /><div className="flex items-end justify-between gap-3"><Skeleton className="h-9 w-64" />{actions && <Skeleton className="h-10 w-28" />}</div></div>;
}
function Details({ fields = 6 }: { fields?: number }) {
  return <Card className="shadow-none"><CardHeader><Skeleton className="h-5 w-28" /></CardHeader><CardContent><div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{Array.from({ length: fields }, (_, i) => <div key={i} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-4/5" /></div>)}</div></CardContent></Card>;
}
export function AdminDetailSkeleton({ kind }: { kind: "participant" | "guest" | "event" | "ticket" }) {
  return <div role="status" aria-label={`Loading ${kind} details`}><Header />
    {kind !== "ticket" && <div className="mb-6 overflow-hidden rounded-xl border border-border"><Skeleton className="h-48 w-full rounded-none sm:h-64 lg:h-80" />{kind !== "event" && <div className="space-y-2 p-4"><Skeleton className="h-3 w-28" /><Skeleton className="h-5 w-52" /></div>}</div>}
    {kind === "event" ? <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><div className="space-y-6"><Details fields={8} /><Details fields={4} /></div><div className="space-y-4">{[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-20 w-full rounded-xl" />)}</div></div> : <div className="space-y-6">{kind === "ticket" && <Card><CardHeader><Skeleton className="h-5 w-28" /></CardHeader><CardContent className="space-y-4"><TicketArtworkSkeleton /><Skeleton className="h-10 w-36" /></CardContent></Card>}<div className={kind === "participant" ? "grid gap-6 lg:grid-cols-2" : "space-y-6"}><Details />{kind === "participant" && <Details fields={4} />}</div>{kind !== "ticket" && <Card><CardHeader><Skeleton className="h-5 w-28" /></CardHeader><CardContent className="space-y-4"><TicketArtworkSkeleton /><Skeleton className="h-10 w-36" /></CardContent></Card>}<Details fields={2} /></div>}
  </div>;
}
export function AdminFormSkeleton({ kind, fields = 6 }: { kind: "event" | "participant" | "guest" | "scanner"; fields?: number }) {
  const controls = <div className={`grid items-start gap-5 ${kind === "scanner" ? "" : kind === "event" ? "sm:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}>{Array.from({ length: fields }, (_, i) => <div key={i} className={kind === "event" && i === 0 ? "space-y-2 sm:col-span-2" : "space-y-2"}><Skeleton className="h-4 w-28" /><Skeleton className="h-11 w-full" /></div>)}</div>;
  return <div role="status" aria-label={`Loading ${kind} form`}><Header actions={false} />{kind === "event" ? <div className="space-y-6"><div className="grid gap-2 sm:grid-cols-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-[4.75rem] w-full" />)}</div><div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-6"><div className="rounded-lg border border-border bg-card/40 p-5 sm:p-6"><Skeleton className="mb-5 h-5 w-40" />{controls}</div><div className="rounded-lg border border-border bg-card/40 p-5 sm:p-6"><Skeleton className="mb-5 h-5 w-40" /><Skeleton className="h-40 w-full" /></div><div className="flex justify-end gap-2 rounded-md border border-border bg-card p-4"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-28" /></div></div><div className="space-y-4 rounded-lg border border-border bg-card p-5"><Skeleton className="aspect-[3/2] w-full" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-36 w-full" /></div></div></div> : <Card className="shadow-none"><CardContent className="space-y-5 pt-6">{controls}<div className="flex justify-end gap-2"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-32" /></div></CardContent></Card>}</div>;
}
export function NotificationSkeleton() {
  return <div role="status" aria-label="Loading notifications" className="space-y-3">{[0, 1, 2, 3, 4, 5].map((key) => <div key={key} className="flex min-h-28 items-start gap-4 rounded-xl border border-border bg-card p-5"><Skeleton className="size-11 shrink-0 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-20" /></div></div>)}</div>;
}
export function RecipientSkeleton() {
  return <div role="status" aria-label="Loading recipients" className="divide-y rounded-lg border">{[0, 1, 2, 3, 4, 5].map((key) => <div key={key} className="flex items-center gap-3 px-3 py-2.5"><Skeleton className="size-4" /><div className="flex-1 space-y-1"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-52" /></div><Skeleton className="hidden h-5 w-20 sm:block" /><Skeleton className="hidden h-4 w-40 md:block" /><Skeleton className="h-9 w-20" /></div>)}</div>;
}
export function EmailTemplatesSkeleton() {
  return <div role="status" aria-label="Loading email templates" className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start"><div className="space-y-2 rounded-xl border bg-card p-3"><Skeleton className="m-2 h-5 w-36" />{[0, 1, 2, 3, 4, 5, 6, 7].map((key) => <Skeleton key={key} className="h-20 w-full rounded-lg" />)}</div><div className="space-y-4 rounded-xl border bg-card p-5"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-[900px] w-full" /></div></div>;
}
export function EmailOverviewSkeleton() {
  return <div role="status" aria-label="Loading email overview" className="space-y-4"><div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((key) => <Card key={key}><CardHeader><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-4/5" /></CardHeader><CardContent className="space-y-5">{[0, 1, 2, 3, 4].map((row) => <div key={row} className="flex justify-between"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-10" /></div>)}</CardContent></Card>)}</div><Card><CardHeader><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-4/5" /></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-20 w-full" />)}</div><Skeleton className="h-72 w-full" /></CardContent></Card></div>;
}

export function AdminListSkeleton({ kind }: { kind: "participants" | "tickets" }) {
  const participants = kind === "participants";
  const headers = participants ? ["Participant", "Event", "Stack", "Verification", "Registration", "Ticket", "Actions"] : ["Ticket", "Holder", "Event", "Status", "Issued", "Actions"];
  return <div><PageHeader title={participants ? "Participants" : "Tickets"} description={participants ? "Everyone registered across your events — approve, edit or export." : "Every issued pass — resend, reset, revoke or generate new ones."} actions={<Skeleton className="h-10 w-36" />} /><DataTable data={[]} columns={headers.map((header) => ({ id: header, header, cell: () => null }))} getRowId={() => ""} searchable={() => ""} searchPlaceholder={participants ? "Search participants…" : "Search by number or holder…"} loading toolbar={<>{Array.from({ length: participants ? 5 : 2 }, (_, key) => <Skeleton key={key} className="h-11 w-36" />)}</>} /></div>;
}
