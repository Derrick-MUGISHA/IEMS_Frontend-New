"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { subscribeLiveStatus, type ConnState } from "@/lib/liveStream";

export type Strength = "strong" | "good" | "weak" | "offline";

export type LiveConnection = {
  state: ConnState;
  /** connection handshake time, ms */
  latencyMs: number | null;
  /** how many times the stream has dropped and reconnected */
  reconnects: number;
  /** ms timestamp of the current open connection */
  since: number | null;
  strength: Strength;
};

const INITIAL: LiveConnection = {
  state: "connecting",
  latencyMs: null,
  reconnects: 0,
  since: null,
  strength: "offline",
};

export function connectionHealth(state: ConnState): Strength {
  if (state === "connecting") return "offline";
  if (state === "error") return "weak";
  return "strong";
}

/* Reports the health of the app's shared live socket — reuses the one
   connection the notifications/scans already run on (no second EventSource),
   checking stream availability; startup latency is reported separately. */
export function useLiveConnection(): LiveConnection {
  const token = useAppSelector((state) => state.auth.sessions.admin.token);
  const [conn, setConn] = useState<LiveConnection>(INITIAL);

  useEffect(() => {
    return subscribeLiveStatus("admin", (s) => {
      setConn({
        state: s.state,
        latencyMs: s.latencyMs,
        reconnects: s.reconnects,
        since: s.since,
        strength: connectionHealth(s.state),
      });
    });
  }, [token]);

  return conn;
}
