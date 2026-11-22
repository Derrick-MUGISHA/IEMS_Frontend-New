"use client";

import { bridgeGetToken } from "./authBridge";
import { openEventStream } from "./eventStream";
import type { Role } from "@/store/authSlice";
import type { NotificationEvent, ScanEvent } from "./scanBus";

/* One EventSource per tab, shared by every live widget (notification bell,
   dashboard feed, gate scanner). Subscribers register handlers; the
   connection opens with the first subscriber and closes with the last. */

export type LiveHandlers = {
  onScan?: (event: ScanEvent) => void;
  onNotification?: (event: NotificationEvent) => void;
};

type Channel = {
  source: ReturnType<typeof openEventStream>;
  idleTimer?: ReturnType<typeof setTimeout>;
  handlers: Set<LiveHandlers>;
  statusListeners: Set<(s: ConnStatus) => void>;
  status: ConnStatus;
  startedAt: number;
};

/* health of the shared socket, for the status page's signal meter */
export type ConnState = "connecting" | "open" | "error";
export type ConnStatus = {
  state: ConnState;
  /** connection handshake time, ms */
  latencyMs: number | null;
  reconnects: number;
  since: number | null;
  lastEventAt: number | null;
};

const channels = new Map<string, Channel>();

function emitStatus(channel: Channel) {
  for (const l of channel.statusListeners) l(channel.status);
}

function closeIfIdle(raw: string, channel: Channel) {
  if (channel.handlers.size === 0 && channel.statusListeners.size === 0) {
    clearTimeout(channel.idleTimer);
    channel.idleTimer = setTimeout(() => {
      if (channel.handlers.size || channel.statusListeners.size) return;
      channel.source.close();
      channels.delete(raw);
    }, 250);
  }
}

/* One shared EventSource per token — both the live handlers (scans,
   notifications) and the status meter read from it, so we never open a second
   competing connection that would stall against the browser's per-host limit. */
function getChannel(raw: string): Channel {
  const existing = channels.get(raw);
  if (existing) {
    clearTimeout(existing.idleTimer);
    return existing;
  }

  const created: Channel = {
    source: { close() {} },
    handlers: new Set(),
    statusListeners: new Set(),
    status: { state: "connecting", latencyMs: null, reconnects: 0, since: null, lastEventAt: null },
    startedAt: performance.now(),
  };
  created.source = openEventStream(`/api/admin/scans/stream?token=${encodeURIComponent(raw)}`, {
    onConnecting: () => { created.startedAt = performance.now(); },
    onOpen: () => {
      created.status = {
        ...created.status,
        state: "open",
        latencyMs: Math.round(performance.now() - created.startedAt),
        since: Date.now(),
        lastEventAt: Date.now(),
      };
      emitStatus(created);
    },
    onHeartbeat: () => {
      created.status = { ...created.status, lastEventAt: Date.now() };
      emitStatus(created);
    },
    onMessage: (msg) => {
      created.status = { ...created.status, lastEventAt: Date.now() };
      try {
        const event = JSON.parse(msg.data) as ScanEvent;
        for (const h of created.handlers) h.onScan?.(event);
      } catch {
        /* malformed frame */
      }
    },
    onNotification: (msg) => {
      created.status = { ...created.status, lastEventAt: Date.now() };
      try {
        const event = JSON.parse((msg as MessageEvent).data) as NotificationEvent;
        for (const h of created.handlers) h.onNotification?.(event);
      } catch {
        /* malformed frame */
      }
    },
    onError: () => {
      created.status = {
        ...created.status,
        state: "error",
        reconnects: created.status.reconnects + 1,
      };
      emitStatus(created);
    },
  });
  channels.set(raw, created);
  return created;
}

export function subscribeLive(role: Role, handlers: LiveHandlers): () => void {
  const raw = bridgeGetToken(role);
  if (!raw) return () => {};
  const channel = getChannel(raw);
  channel.handlers.add(handlers);
  return () => {
    channel.handlers.delete(handlers);
    closeIfIdle(raw, channel);
  };
}

/* Observe the shared socket's health without opening another connection. */
export function subscribeLiveStatus(
  role: Role,
  onStatus: (s: ConnStatus) => void
): () => void {
  const raw = bridgeGetToken(role);
  if (!raw) {
    onStatus({ state: "error", latencyMs: null, reconnects: 0, since: null, lastEventAt: null });
    return () => {};
  }
  const channel = getChannel(raw);
  channel.statusListeners.add(onStatus);
  onStatus(channel.status); /* hand back the current state at once */
  return () => {
    channel.statusListeners.delete(onStatus);
    closeIfIdle(raw, channel);
  };
}

/* Public counterpart for the landing page: one connection shared by Nav,
   Hero and the calendar; fires whenever event content changes. */
const publicListeners = new Set<() => void>();
let publicSource: ReturnType<typeof openEventStream> | null = null;
let publicIdleTimer: ReturnType<typeof setTimeout> | undefined;

export function subscribeEventsFeed(onChange: () => void): () => void {
  clearTimeout(publicIdleTimer);
  publicListeners.add(onChange);
  if (!publicSource) {
    const refresh = () => {
      for (const listener of publicListeners) listener();
    };
    publicSource = openEventStream("/api/events/stream", {
      onOpen: refresh,
      onMessage: refresh,
    });
  }
  return () => {
    publicListeners.delete(onChange);
    if (publicListeners.size === 0) {
      publicIdleTimer = setTimeout(() => {
        if (publicListeners.size) return;
        publicSource?.close();
        publicSource = null;
      }, 250);
    }
  };
}
