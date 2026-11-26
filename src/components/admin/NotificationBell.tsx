"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bell, CheckCheck, Info, ShieldAlert, UserCheck, UserPlus } from "lucide-react";
import { useNotifications, useMarkNotificationsRead } from "@/hooks/admin/dashboard";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AdminNotification } from "@/types/admin";

const KIND_ICON: Record<AdminNotification["kind"], { icon: typeof Bell; className: string }> = {
  CHECK_IN: { icon: UserCheck, className: "bg-emerald-500/10 text-emerald-400" },
  SCAN_ALERT: { icon: ShieldAlert, className: "bg-amber-500/10 text-amber-400" },
  GUEST_ADDED: { icon: UserPlus, className: "bg-secondary text-green" },
  SYSTEM: { icon: Info, className: "bg-muted text-muted-foreground" },
};

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, isPending, error, refetch } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = data?.unread ?? 0;
  const items = data?.notifications.slice(0, 5) ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread} unread`}>
          <Bell aria-hidden="true" className="size-5" />
          {unread > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" sideOffset={10} className="notification-dropdown" aria-label="Recent notifications">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div><h2 className="font-semibold">Notifications</h2><p className="mt-1 text-xs text-muted-foreground">{unread} unread · Latest activity</p></div>
          {unread > 0 && <Button variant="ghost" size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate(undefined)}><CheckCheck aria-hidden="true" className="size-4" /><span className="sr-only sm:not-sr-only">Mark all read</span></Button>}
        </div>
        <div className="max-h-[min(26rem,60dvh)] overflow-y-auto">
          {isPending ? <p className="p-6 text-center text-sm text-muted-foreground" role="status">Loading notifications…</p> : error ? (
            <div className="space-y-3 p-5 text-center"><p className="text-sm text-muted-foreground">Couldn’t load notifications.</p><Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button></div>
          ) : items.length === 0 ? (
            <div className="space-y-2 p-8 text-center"><Bell aria-hidden="true" className="mx-auto size-6 text-muted-foreground" /><p className="text-sm font-medium">You’re all caught up</p><p className="text-xs text-muted-foreground">Check-ins, guest activity and alerts appear here.</p></div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const { icon: Icon, className } = KIND_ICON[n.kind] ?? KIND_ICON.SYSTEM;
                return <li key={n.id} className={cn("flex gap-3 p-4", !n.read && "bg-primary/5")}>
                  <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", className)}><Icon aria-hidden="true" className="size-4" /></span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{n.title}</p>{n.body && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{n.body}</p>}<time dateTime={n.at} className="mt-1.5 block text-[11px] text-muted-foreground">{timeAgo(n.at)}</time></div>
                  {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </li>;
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-3"><Button variant="ghost" className="w-full" asChild><Link href="/admin/notifications" onClick={() => setOpen(false)}>View more<ArrowRight aria-hidden="true" className="size-4" /></Link></Button></div>
      </PopoverContent>
    </Popover>
  );
}
