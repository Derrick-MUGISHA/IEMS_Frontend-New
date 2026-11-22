"use client";

import { NotificationSkeleton } from "@/components/admin/PageSkeletons";

import { useState } from "react";
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, ChevronDown, Clock, Info, X, XCircle } from "lucide-react";
import { useNotifications, useMarkNotificationsRead } from "@/hooks/admin/dashboard";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, ErrorState } from "@/components/admin/states";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const ICON = {
  success: <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-400" />,
  warning: <AlertTriangle aria-hidden="true" className="size-4 text-amber-400" />,
  error: <XCircle aria-hidden="true" className="size-4 text-red-400" />,
  info: <Info aria-hidden="true" className="size-4 text-sky-400" />,
};

export default function NotificationsPage() {
  const { data, isPending, error, refetch } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [activeId, setActiveId] = useState<string | null>(null);
  const items = data?.notifications ?? [];

  return (
    <div className="w-full">
      <PageHeader title="Notifications" description="Gate check-ins, guest activity and system alerts. Select a notification to read its details." actions={
        <Button variant="outline" onClick={() => markRead.mutate(undefined)} disabled={markRead.isPending || (data?.unread ?? 0) === 0}><CheckCheck aria-hidden="true" className="size-4" />Mark all read</Button>
      } />
      {isPending ? <NotificationSkeleton /> : error ? <ErrorState message={error.message} onRetry={() => refetch()} /> : items.length === 0 ? (
        <EmptyState icon={<Bell aria-hidden="true" className="size-5" />} title="No notifications" message="Activity from the gate and your team shows up here." />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => <li key={n.id}>
            <Popover open={activeId === n.id} onOpenChange={(open) => {
              setActiveId(open ? n.id : null);
              if (open && !n.read) markRead.mutate([n.id]);
            }}>
              <PopoverTrigger asChild data-slot="notification-row-trigger">
                <button type="button" data-unread={!n.read} className={cn("group flex h-auto min-h-28 w-full cursor-pointer items-start justify-start gap-4 whitespace-normal rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:border-primary", !n.read && "border-primary/30 bg-primary/5")}>
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", n.severity === "warning" ? "bg-amber-500/10" : n.severity === "error" ? "bg-red-500/10" : n.severity === "success" ? "bg-emerald-500/10" : "bg-sky-500/10")}>{ICON[n.severity]}</span>
                  <span className="min-w-0 flex-1 space-y-2">
                    <span className="flex flex-wrap items-center gap-2"><span className="font-semibold leading-snug text-foreground">{n.title}</span>{!n.read && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Unread</span>}</span>
                    {n.body && <span className="line-clamp-2 text-sm font-normal leading-relaxed text-muted-foreground">{n.body}</span>}
                    <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground"><Clock aria-hidden="true" className="size-3.5" /><time dateTime={n.at}>{new Date(n.at).toLocaleString()}</time></span>
                  </span>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"><ChevronDown aria-hidden="true" className="size-4 transition-transform group-data-[state=open]:rotate-180" /></span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" sideOffset={10} collisionPadding={16} className="notification-detail" aria-labelledby={`notification-title-${n.id}`}>
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{ICON[n.severity]}{n.severity}</span><Button variant="ghost" size="icon-sm" aria-label="Close notification details" onClick={() => setActiveId(null)}><X aria-hidden="true" className="size-4" /></Button></div>
                <h2 id={`notification-title-${n.id}`} className="text-base font-semibold">{n.title}</h2>
                <time dateTime={n.at} className="text-xs text-muted-foreground">{new Date(n.at).toLocaleString()}</time>
                <p className="whitespace-pre-wrap break-words border-t border-border pt-3 text-sm leading-relaxed">{n.body || "No additional details."}</p>
              </PopoverContent>
            </Popover>
          </li>)}
        </ul>
      )}
    </div>
  );
}
