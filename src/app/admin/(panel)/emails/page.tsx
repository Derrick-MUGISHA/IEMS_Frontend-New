"use client";

import { RecipientSkeleton, EmailTemplatesSkeleton, EmailOverviewSkeleton } from "@/components/admin/PageSkeletons";
import { Skeleton } from "@/components/ui/skeleton";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Eye,
  Hourglass,
  MailCheck,
  MailWarning,
  Send,
  UserX,
  CalendarDays,
  LayoutDashboard,
  History,
  ListFilter,
  ShieldCheck,
  X,
  ArrowUpRight,
  Mail,
  FileText,
  Users,
  Check,
} from "lucide-react";
import {
  useEmailDetail,
  useEmailReport,
  useEmailTemplates,
  useRunReminders,
  useSendPassEmails,
} from "@/hooks/admin/emails";
import { useParticipants } from "@/hooks/admin/participants";
import { useEvents } from "@/hooks/admin/events";
import { EventPicker } from "@/components/admin/EventPicker";
import { EventImage } from "@/components/admin/EventImage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState, ErrorState } from "@/components/admin/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EMAIL_KINDS,
  type AdminParticipant,
  type EmailKind,
  type EmailLogRow,
  type EmailTemplatePreview,
} from "@/types/admin";

const KIND_LABEL: Record<EmailKind, string> = {
  MAGIC_LINK: "Verify email",
  CONFIRMATION: "Registration confirmed",
  PLUS_ONE_INVITE: "Plus-one invite",
  TICKET: "Event pass",
  TICKET_NUDGE: "Get your ticket",
  REMINDER: "Reminder",
  PROGRESS_REMINDER: "Progress reminder",
  PLUS_ONE_REVOKED: "Plus-one removed",
  UPDATE: "Event update",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function EmailsPage() {
  const [openLogId, setOpenLogId] = useState<string | null>(null);
  const [logKind, setLogKind] = useState("all");
  const [logStatus, setLogStatus] = useState("all");
  const runReminders = useRunReminders();
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [reminderEventId, setReminderEventId] = useState("");
  const { data: events } = useEvents();
  const reminderEvent = events?.find((event) => event.id === reminderEventId);
  const canRemind = Boolean(reminderEvent && reminderEvent.status === "OPEN" && new Date(reminderEvent.startTime) > new Date());

  async function sendReminders() {
    if (!canRemind) return;
    try {
      await runReminders.mutateAsync(reminderEventId);
      setRemindersOpen(false);
      setReminderEventId("");
    } catch { /* The mutation displays the send error; keep the selection for retry. */ }
  }

  const logFilters = {
    kind: logKind === "all" ? undefined : logKind,
    status: logStatus === "all" ? undefined : logStatus,
  };
  const { data, isPending, error, refetch } = useEmailReport(logFilters);

  if (error) return <ErrorState message="Couldn't load the email report." onRetry={refetch} />;

  const report = data?.report;
  const logs = data?.logs ?? [];

  return (
    <div className="w-full">
      <PageHeader
        title="Emails"
        description="Manage event messages, preview the emails people receive, and track delivery."
        crumbs={[{ label: "Emails" }]}
        actions={
          <Button onClick={() => setRemindersOpen(true)} disabled={runReminders.isPending}>
            <MailCheck aria-hidden="true" className="size-4" />
            {runReminders.isPending ? "Sending…" : "Send progress reminders"}
          </Button>
        }
      />

      <Dialog open={remindersOpen} onOpenChange={(open) => { if (!runReminders.isPending) setRemindersOpen(open); }}>
        <DialogContent className="email-reminders-dialog">
          <DialogHeader>
            <span className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><MailCheck aria-hidden="true" className="size-6" /></span>
            <DialogTitle className="text-xl">Send progress reminders</DialogTitle>
            <DialogDescription>Choose the programme or event, review its details, then send a reminder for each participant’s next step.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reminder-event"><CalendarDays aria-hidden="true" className="size-4" />Programme / event</Label>
            <EventPicker id="reminder-event" value={reminderEventId} onValueChange={setReminderEventId} disabled={runReminders.isPending} placeholder="Choose a programme or event" className="w-full" />
          </div>
          {reminderEvent && (
            <div className="space-y-4 rounded-xl border bg-muted/30 p-4 text-sm">
              <div className="flex items-center gap-3">
                <EventImage thumbnail images={reminderEvent.gallery} name={reminderEvent.name} className="h-16 w-24" />
                <div className="min-w-0"><p className="font-semibold">{reminderEvent.name}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(reminderEvent.startTime).toLocaleDateString()} · {reminderEvent.location || "Venue pending"}</p></div>
              </div>
              <p className="text-muted-foreground">{canRemind ? "Only this programme’s eligible participants will be contacted. Rejected registrations and people reminded in the last 20 hours are skipped." : "Reminders are available for upcoming, open programmes and events. Choose another event."}</p>
            </div>
          )}
          <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>Review the selected programme before sending. This action emails eligible participants immediately.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={runReminders.isPending} onClick={() => setRemindersOpen(false)}><X aria-hidden="true" className="size-4" />Cancel</Button>
            <Button disabled={!canRemind || runReminders.isPending} onClick={() => void sendReminders()}><Send aria-hidden="true" className="size-4" />{runReminders.isPending ? "Sending…" : "Send reminders"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={MailCheck}
          label="Emails sent"
          value={report?.totals.sent ?? 0}
          hint={report ? `${report.totals.sentLast7d} in the last 7 days` : undefined}
          tone="green"
          loading={isPending}
        />
        <StatCard
          icon={MailWarning}
          label="Failed sends"
          value={report?.totals.failed ?? 0}
          hint="delivery errors, see the log"
          tone="orange"
          loading={isPending}
        />
        <StatCard
          icon={Hourglass}
          label="Awaiting delivery or action"
          value={report?.upcoming.total ?? 0}
          hint="passes pending and unfinished registrations"
          tone="blue"
          loading={isPending}
        />
        <StatCard
          icon={UserX}
          label="Never finished applying"
          value={report?.funnel.overall.abandoned ?? 0}
          hint={
            report
              ? `${report.funnel.overall.completionRate}% of applicants complete`
              : undefined
          }
          tone="zinc"
          loading={isPending}
        />
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="email-tabs-list" aria-label="Email management">
          <TabsTrigger value="overview"><LayoutDashboard aria-hidden="true" className="size-5" /><span className="text-left"><span className="block font-semibold">Overview</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Delivery &amp; registration</span></span></TabsTrigger>
          <TabsTrigger value="send"><Send aria-hidden="true" className="size-5" /><span className="text-left"><span className="block font-semibold">Send passes</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Choose your recipients</span></span></TabsTrigger>
          <TabsTrigger value="templates"><Eye aria-hidden="true" className="size-5" /><span className="text-left"><span className="block font-semibold">What users see</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Preview every email</span></span></TabsTrigger>
          <TabsTrigger value="log"><History aria-hidden="true" className="size-5" /><span className="text-left"><span className="block font-semibold">Send log</span><span className="mt-1 block text-xs font-normal text-muted-foreground">History &amp; delivery errors</span></span></TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {isPending || !report ? (
            <EmailOverviewSkeleton />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <UpcomingCard report={report} />
                <ByKindCard report={report} />
              </div>
              <FunnelCard report={report} />
            </>
          )}
        </TabsContent>

        <TabsContent value="send" className="mt-4">
          <SendTab />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <LogTab
            logs={logs}
            loading={isPending}
            onOpen={setOpenLogId}
            kind={logKind}
            status={logStatus}
            onKindChange={setLogKind}
            onStatusChange={setLogStatus}
          />
        </TabsContent>
      </Tabs>

      <EmailPreviewDialog id={openLogId} onClose={() => setOpenLogId(null)} />
    </div>
  );
}

/* ------------------------------------------------------------- overview */

function UpcomingCard({ report }: { report: NonNullable<ReturnType<typeof useEmailReport>["data"]>["report"] }) {
  const rows = [
    {
      icon: Send,
      label: "Pass delivery pending",
      hint: "A pass exists, but a successful email delivery has not been recorded.",
      status: "Delivery pending",
      tone: "text-sky-400 bg-sky-500/10",
      value: report.upcoming.ticketQueued,
    },
    {
      icon: Clock,
      label: "Email verification needed",
      hint: "The participant must verify their email before registration can continue.",
      status: "Participant action",
      tone: "text-amber-400 bg-amber-500/10",
      value: report.upcoming.confirmationQueued,
    },
    {
      icon: Hourglass,
      label: "Profile completion needed",
      hint: "Their email is verified. Completing their profile triggers pass delivery.",
      status: "Participant action",
      tone: "text-violet-400 bg-violet-500/10",
      value: report.upcoming.awaitingTicketEmail,
    },
    {
      icon: MailCheck,
      label: "Upcoming event registrations",
      hint: "Registrations linked to future events. Reminder eligibility is checked when sending.",
      status: "Upcoming audience",
      tone: "text-emerald-400 bg-emerald-500/10",
      value: report.upcoming.reminderPool,
    },
  ];
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Send aria-hidden="true" className="size-4" />Delivery &amp; next steps</CardTitle>
        <CardDescription>See what is waiting, who needs to act, and what triggers the next email.</CardDescription>
      </CardHeader>
      <CardContent className="grid flex-1 gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col items-start gap-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex w-full items-center justify-between gap-3">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", r.tone)}><r.icon aria-hidden="true" className="size-5" /></span>
              <span className="text-3xl font-semibold tabular-nums">{r.value}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{r.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.hint}</p>
            </div>
            <span className={cn("rounded-full px-2 py-1 text-[11px] font-medium", r.tone)}>{r.status}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ByKindCard({ report }: { report: NonNullable<ReturnType<typeof useEmailReport>["data"]>["report"] }) {
  const kinds = Object.entries(report.totals.byKind) as [EmailKind, { sent: number; failed: number }][];
  const attempts = report.totals.sent + report.totals.failed;
  const rate = attempts ? Math.round(report.totals.sent / attempts * 100) : null;
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><History aria-hidden="true" className="size-4" />Sent by template</CardTitle>
        <CardDescription>Retained send attempts by template, including failures and success rate.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
          <div><p className="text-xs text-muted-foreground">Successful send attempts</p><p className="mt-1 text-2xl font-semibold tabular-nums">{rate === null ? "—" : `${rate}%`}</p></div>
          <span className="text-right text-xs text-muted-foreground">{report.totals.sent} sent<br/>{report.totals.failed} failed · {attempts} attempts</span>
        </div>
        <div className="mb-2 grid grid-cols-[minmax(0,1fr)_3rem_3rem_3.5rem] gap-2 text-[11px] font-medium text-muted-foreground"><span>Template</span><span className="text-right">Sent</span><span className="text-right">Failed</span><span className="text-right">Success</span></div>
        <div className="divide-y divide-border">
          {kinds.map(([kind, n]) => (
            <div key={kind} className="grid grid-cols-[minmax(0,1fr)_3rem_3rem_3.5rem] items-center gap-2 py-3 text-sm">
              <span className="font-medium">{KIND_LABEL[kind]}</span>
              <span className="text-right tabular-nums text-emerald-400">{n.sent}</span>
              <span className={cn("text-right tabular-nums", n.failed ? "text-red-400" : "text-muted-foreground")}>{n.failed}</span>
              <span className="text-right text-xs tabular-nums text-muted-foreground">{n.sent + n.failed ? `${Math.round(n.sent / (n.sent + n.failed) * 100)}%` : "—"}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelCard({ report }: { report: NonNullable<ReturnType<typeof useEmailReport>["data"]>["report"] }) {
  const o = report.funnel.overall;
  const columns: Column<(typeof report.funnel.perEvent)[number]>[] = [
    { id: "event", header: "Programme / event", cell: (r) => (
      <div className="flex min-w-64 items-center gap-3 py-1">
        <EventImage thumbnail images={r.gallery} name={r.eventName} className="h-14 w-20 rounded-lg" />
        <div className="min-w-0"><Link href={`/admin/events/${r.eventId}`} className="font-medium hover:underline">{r.eventName}</Link><p className="mt-1 text-xs text-muted-foreground">{r.startTime ? new Date(r.startTime).toLocaleDateString() : "Date unavailable"} · {r.location || "Venue pending"}</p></div>
      </div>
    ), sortValue: (r) => r.eventName },
    { id: "started", header: "Started", cell: (r) => r.started, sortValue: (r) => r.started, className: "tabular-nums" },
    {
      id: "neverVerified",
      header: "Never verified email",
      cell: (r) => <span className={cn(r.neverVerified > 0 && "text-amber-600")}>{r.neverVerified}</span>,
      sortValue: (r) => r.neverVerified,
      className: "tabular-nums",
    },
    {
      id: "verifiedNotCompleted",
      header: "Verified, no profile",
      cell: (r) => <span className={cn(r.verifiedNotCompleted > 0 && "text-amber-600")}>{r.verifiedNotCompleted}</span>,
      sortValue: (r) => r.verifiedNotCompleted,
      className: "tabular-nums",
    },
    { id: "completed", header: "Completed", cell: (r) => r.completed, sortValue: (r) => r.completed, className: "tabular-nums" },
    {
      id: "rate",
      header: "Completion",
      cell: (r) => <div className="email-funnel-progress w-24 space-y-1.5"><span className="text-xs font-semibold">{r.started ? Math.round((r.completed / r.started) * 100) : 0}%</span><Progress value={r.started ? r.completed / r.started * 100 : 0} /></div>,
      sortValue: (r) => (r.started ? r.completed / r.started : 0),
      className: "tabular-nums",
    },
    { id: "participants", header: "", className: "w-14 text-center", cell: (r) => <Button variant="ghost" size="icon-sm" className="email-funnel-link" asChild><Link href={`/admin/attendees?event=${r.eventId}`} aria-label={`View participants for ${r.eventName}`}><ArrowUpRight aria-hidden="true" className="size-4 shrink-0" /></Link></Button> },
  ];

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ListFilter aria-hidden="true" className="size-4" />Application funnel</CardTitle>
        <CardDescription>
          People who clicked apply but never finished: {o.neverVerified} never verified their
          email, {o.verifiedNotCompleted} verified but never completed their profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Applications started", value: o.started, icon: Users },
            { label: "Awaiting verification", value: o.neverVerified, icon: Mail },
            { label: "Profile incomplete", value: o.verifiedNotCompleted, icon: UserX },
            { label: "Registration complete", value: o.completed, icon: Check },
          ].map((item) => <div key={item.label} className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3"><item.icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><div><p className="text-xl font-semibold tabular-nums">{item.value}</p><p className="text-xs text-muted-foreground">{item.label}</p></div></div>)}
        </div>
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>
              {o.completed} of {o.started} applications completed
            </span>
            <span className="font-semibold">{o.completionRate}%</span>
          </div>
          <Progress value={o.completionRate} />
        </div>
        <DataTable
          data={report.funnel.perEvent}
          columns={columns}
          getRowId={(r) => r.eventId}
          pageSize={8}
          searchable={(row) => `${row.eventName} ${row.location ?? ""}`}
          searchPlaceholder="Search programmes or events…"
          empty={<EmptyState title="No applications yet" message="Funnel numbers appear once people start registering." />}
        />
      </CardContent>
    </Card>
  );
}

/* ----------------------------------------------------------- send passes */

const P_STATUS: Record<AdminParticipant["status"], { label: string; cls: string }> = {
  PENDING: { label: "Email not verified", cls: "bg-amber-100 text-amber-800" },
  VERIFIED: { label: "Profile unfinished", cls: "bg-sky-100 text-sky-800" },
  COMPLETE: { label: "Pass issued", cls: "bg-green-100 text-green-800" },
};

function SendTab() {
  const [eventId, setEventId] = useState("");
  const { data: attendees, isPending } = useParticipants(eventId ? { event: eventId } : {});
  const send = useSendPassEmails();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);

  const list = useMemo(() => attendees ?? [], [attendees]);
  const byId = useMemo(() => new Map(list.map((p) => [p.id, p])), [list]);
  const allChecked = list.length > 0 && list.every((p) => selected.has(p.id));

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function confirmSend() {
    if (!pendingIds?.length) return;
    try {
      await send.mutateAsync(pendingIds);
      setPendingIds(null);
      setSelected(new Set());
    } catch {
      /* the hook already toasts the failure; keep the dialog open to retry */
    }
  }

  const pending = (pendingIds ?? []).map((id) => byId.get(id)).filter(Boolean) as AdminParticipant[];
  const nPass = pending.filter((p) => p.ticket).length;
  const nNudge = pending.length - nPass;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Send aria-hidden="true" className="size-4" />Send passes by email</CardTitle>
        <CardDescription>
          Pick an event, choose everyone or a single person, and review before anything is sent.
          People who already hold a pass get it re-sent; people who never finished applying get a
          sign-in link to complete their profile and receive their pass.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <EventPicker value={eventId} onValueChange={(v) => { setEventId(v); setSelected(new Set()); }} className="w-72" />
          {list.length > 0 && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(on) =>
                    setSelected(on ? new Set(list.map((p) => p.id)) : new Set())
                  }
                />
                Select all ({list.length})
              </label>
              <Button
                className="ml-auto"
                disabled={selected.size === 0 || send.isPending}
                onClick={() => setPendingIds([...selected])}
              >
                <Send className="size-4" />
                Review &amp; send to {selected.size || "…"}
              </Button>
            </>
          )}
        </div>

        {!eventId ? (
          <EmptyState title="Choose an event" message="Participants of the selected event appear here." />
        ) : isPending ? (
          <RecipientSkeleton />
        ) : list.length === 0 ? (
          <EmptyState title="No participants" message="Nobody has registered for this event yet." />
        ) : (
          <div className="divide-y rounded-lg border">
            {list.map((p) => {
              const st = P_STATUS[p.status];
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={(on) => toggle(p.id, on === true)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  <Badge className={cn("hidden sm:inline-flex", st.cls)}>{st.label}</Badge>
                  <span className="hidden w-40 text-right text-xs text-muted-foreground md:block">
                    will get: {p.ticket ? "pass email" : "sign-in nudge"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={send.isPending}
                    onClick={() => setPendingIds([p.id])}
                  >
                    <Send aria-hidden="true" className="size-4" />Send
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* confirm-before-send: nothing goes out until this is approved */}
      <Dialog open={Boolean(pendingIds)} onOpenChange={(open) => !open && setPendingIds(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm before sending</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pending.length === 1 ? (
              <>
                One email to <span className="font-medium text-foreground">{pending[0]?.name}</span>{" "}
                ({pending[0]?.email}) —{" "}
                {pending[0]?.ticket
                  ? "their event pass will be re-sent."
                  : "they'll get a sign-in link to finish registration and receive their pass."}
              </>
            ) : (
              <>
                {pending.length} emails: <span className="font-medium text-foreground">{nPass}</span>{" "}
                pass re-send{nPass === 1 ? "" : "s"} and{" "}
                <span className="font-medium text-foreground">{nNudge}</span> finish-registration
                nudge{nNudge === 1 ? "" : "s"}.
              </>
            )}{" "}
            You can preview both templates under “What users see”.
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">
                  {p.name} <span className="text-muted-foreground">· {p.email}</span>
                </span>
                <Badge variant="outline" className="shrink-0">
                  {p.ticket ? "Pass" : "Nudge"}
                </Badge>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={send.isPending} onClick={() => setPendingIds(null)}>
              Cancel
            </Button>
            <Button disabled={send.isPending} onClick={() => void confirmSend()}>
              {send.isPending ? "Sending…" : `Send ${pending.length} email${pending.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------------------------------------------------ templates */

function TemplatesTab() {
  const { data: templates, isPending, error, refetch } = useEmailTemplates();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected: EmailTemplatePreview | undefined = useMemo(() => {
    if (!templates?.length) return undefined;
    return templates.find((t) => t.id === selectedId) ?? templates[0];
  }, [templates, selectedId]);

  if (error) return <ErrorState message="Couldn't load the templates." onRetry={refetch} />;
  if (isPending) return <EmailTemplatesSkeleton />;
  if (!templates?.length)
    return <EmptyState title="No templates" message="No email templates were found." />;

  return (
    <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start">
      <div className="email-template-sidebar rounded-xl border bg-card p-3">
        <div className="mb-3 flex shrink-0 items-center justify-between px-2 py-2"><p className="flex items-center gap-2 text-sm font-semibold"><FileText aria-hidden="true" className="size-4" />Email templates</p><Badge variant="outline">{templates.length}</Badge></div>
        <div className="email-template-options grid gap-2 sm:grid-cols-2 xl:grid-cols-1 xl:pr-1">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={selected?.id === t.id}
            onClick={() => setSelectedId(t.id)}
            className={cn(
              "email-template-option flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selected?.id === t.id
                ? "border-primary/40 bg-primary/5"
                : "border-transparent hover:bg-muted"
            )}
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Mail aria-hidden="true" className="size-4" /></span>
            <span><span className="block text-sm font-medium">{t.name}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{t.description}</span></span>
          </button>
        ))}
        </div>
      </div>
      {selected && (
        <Card className="min-w-0 shadow-none">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-base"><Eye aria-hidden="true" className="size-4" />{selected.name}</CardTitle><Badge variant="outline">Live template preview</Badge></div>
            <CardDescription>
              Subject: <span className="font-medium text-foreground">{selected.subject}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-xs sm:grid-cols-2">
              <div><p className="text-muted-foreground">From</p><p className="mt-1 break-words font-medium">{selected.from || "Igire Rwanda Official Team <no-reply@igirerwanda.org>"}</p></div>
              <div><p className="text-muted-foreground">Preview recipient</p><p className="mt-1 font-medium">Sample registration · personalised when sent</p></div>
            </div>
            <iframe
              title={`${selected.name} preview`}
              srcDoc={selected.html}
              sandbox=""
              className="h-[900px] w-full rounded-none border-0 bg-transparent [color-scheme:dark]"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Rendered from the live template with sample data — recipients see exactly this
              layout with their own details.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- send log */

function LogTab({
  logs,
  loading,
  onOpen,
  kind,
  status,
  onKindChange,
  onStatusChange,
}: {
  logs: EmailLogRow[];
  loading: boolean;
  onOpen: (id: string) => void;
  kind: string;
  status: string;
  onKindChange: (v: string) => void;
  onStatusChange: (v: string) => void;
}) {
  const filters = (
    <>
      <Select value={kind} onValueChange={onKindChange}>
        <SelectTrigger className="h-9 w-44">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {EMAIL_KINDS.map((k) => (
            <SelectItem key={k} value={k}>
              {KIND_LABEL[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="h-9 w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="SENT">Sent</SelectItem>
          <SelectItem value="FAILED">Failed</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  const columns: Column<EmailLogRow>[] = [
    {
      id: "kind",
      header: "Type",
      cell: (r) => <Badge variant="outline">{KIND_LABEL[r.kind]}</Badge>,
      sortValue: (r) => r.kind,
    },
    { id: "to", header: "Recipient", cell: (r) => r.to, sortValue: (r) => r.to },
    {
      id: "subject",
      header: "Subject",
      cell: (r) => <span className="line-clamp-1">{r.subject}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (r) =>
        r.status === "SENT" ? (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Sent</Badge>
        ) : (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100" title={r.error ?? undefined}>
            Failed
          </Badge>
        ),
      sortValue: (r) => r.status,
    },
    { id: "at", header: "When", cell: (r) => when(r.at), sortValue: (r) => r.at, className: "tabular-nums" },
    {
      id: "view",
      header: "",
      cell: () => <Eye className="size-4 text-muted-foreground" />,
      className: "w-10",
    },
  ];


  return (
    <DataTable
      data={logs}
      loading={loading}
      columns={columns}
      getRowId={(r) => r.id}
      onRowClick={(r) => onOpen(r.id)}
      searchable={(r) => `${r.to} ${r.subject} ${r.kind}`}
      searchPlaceholder="Search recipient or subject…"
      pageSize={12}
      toolbar={filters}
      empty={
        <EmptyState
          title="No emails logged yet"
          message="Sends are recorded from now on — new registrations, passes and reminders will appear here."
        />
      }
    />
  );
}

function EmailPreviewDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: email, isPending } = useEmailDetail(id);
  return (
    <Dialog open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base">
            {email ? email.subject : "Email"}
          </DialogTitle>
        </DialogHeader>
        {email && (
          <p className="text-xs text-muted-foreground">
            {KIND_LABEL[email.kind]} · to {email.to} · {when(email.at)}
            {email.status === "FAILED" && (
              <span className="ml-1 font-medium text-red-600">
                — failed{email.error ? `: ${email.error}` : ""}
              </span>
            )}
          </p>
        )}
        {isPending ? (
          <Skeleton className="h-[600px] w-full" />
        ) : email ? (
          <iframe
            title="Sent email"
            srcDoc={email.html}
            sandbox=""
            className="h-[600px] w-full rounded-none border-0 bg-transparent [color-scheme:dark]"
          />
        ) : (
          <EmptyState title="Not found" message="This email is no longer in the log." />
        )}
      </DialogContent>
    </Dialog>
  );
}
