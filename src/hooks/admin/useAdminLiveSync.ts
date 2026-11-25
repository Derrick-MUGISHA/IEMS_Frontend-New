"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeLive, subscribeEventsFeed } from "@/lib/liveStream";
import { useAppSelector } from "@/store/hooks";
import { adminKeys } from "./keys";

/* Keeps the whole admin panel live: gate scans, new notifications and event
   edits stream in over SSE and invalidate the matching caches, so lists and
   stats refresh on their own without anyone reaching for the reload button. */
export function useAdminLiveSync() {
  const qc = useQueryClient();
  const token = useAppSelector((state) => state.auth.sessions.admin.token);

  useEffect(() => {
    if (!token) return;
    let activityTimer: ReturnType<typeof setTimeout> | undefined;
    /* a check-in or admin notification moves tickets, headcounts and stats */
    const refreshActivity = () => {
      activityTimer = undefined;
      qc.invalidateQueries({ queryKey: adminKeys.notifications }, { cancelRefetch: false });
      qc.invalidateQueries({ queryKey: adminKeys.dashboard }, { cancelRefetch: false });
      qc.invalidateQueries({ queryKey: adminKeys.eventStats }, { cancelRefetch: false });
      qc.invalidateQueries({ queryKey: adminKeys.ticketsAll }, { cancelRefetch: false });
      qc.invalidateQueries({ queryKey: adminKeys.participantsAll }, { cancelRefetch: false });
      qc.invalidateQueries({ queryKey: adminKeys.guests }, { cancelRefetch: false });
      /* per-event engagement (reminder pool, plus-one split) + the email report
         all move with headcounts and sends — refresh them live too. Prefix keys
         match every id/filter variant. */
      qc.invalidateQueries({ queryKey: ["admin", "event-engagement"] }, { cancelRefetch: false });
      qc.invalidateQueries({ queryKey: ["admin", "emails"] }, { cancelRefetch: false });
    };
    const onActivity = () => {
      if (!activityTimer) activityTimer = setTimeout(refreshActivity, 1000);
    };
    const offLive = subscribeLive("admin", {
      onScan: onActivity,
      onNotification: onActivity,
    });

    /* event content changes (create/edit/publish) touch the event lists + stats */
    const offEvents = subscribeEventsFeed(() => {
      qc.invalidateQueries({ queryKey: adminKeys.events }, { cancelRefetch: false });
      qc.invalidateQueries({ queryKey: adminKeys.eventStats }, { cancelRefetch: false });
      qc.invalidateQueries({ queryKey: adminKeys.dashboard }, { cancelRefetch: false });
      qc.invalidateQueries({ queryKey: ["admin", "event-engagement"] }, { cancelRefetch: false });
    });

    return () => {
      offLive();
      offEvents();
      clearTimeout(activityTimer);
    };
  }, [qc, token]);
}
