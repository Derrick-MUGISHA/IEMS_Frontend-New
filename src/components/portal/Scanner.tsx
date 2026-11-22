"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import type QrScanner from "qr-scanner";
import { CameraSession, ScanSession } from "@/lib/scannerSession";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Camera,
  CameraOff,
  RefreshCw,
  Flashlight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Hourglass,
  ShieldX,
  XCircle,
  ScanLine,
  Wifi,
  WifiOff,
  Activity,
} from "lucide-react";
import { api } from "@/lib/client";
import type { Role } from "@/store/authSlice";
import { subscribeLive } from "@/lib/liveStream";
import type { ScanEvent } from "@/lib/scanBus";
import { Panel, Note, Spinner } from "./ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatEventDateTime, formatEventTime } from "@/lib/time";
import { Input } from "@/components/ui/input";

type ScanResponse = ScanEvent & { cohort?: string | null };

/* feed entries carry the gate snapshot only for scans made on this device */
type FeedItem = ScanEvent & { snapshot?: string };

const RESULT_STYLE: Record<
  ScanEvent["result"],
  { label: string; icon: typeof CheckCircle2; className: string; iconClass: string; dot: string }
> = {
  ACCEPTED: {
    label: "Welcome in",
    icon: CheckCircle2,
    className: "border-green",
    iconClass: "text-green",
    dot: "bg-green",
  },
  ALREADY_USED: {
    label: "Already used",
    icon: XCircle,
    className: "border-terracotta",
    iconClass: "text-terracotta",
    dot: "bg-terracotta",
  },
  REVOKED: {
    label: "Revoked pass",
    icon: ShieldX,
    className: "border-terracotta",
    iconClass: "text-terracotta",
    dot: "bg-terracotta",
  },
  INVALID: {
    label: "Invalid ticket",
    icon: XCircle,
    className: "border-terracotta",
    iconClass: "text-terracotta",
    dot: "bg-terracotta",
  },
  EXPIRED: {
    label: "Ticket expired",
    icon: Hourglass,
    className: "border-tan",
    iconClass: "text-tan",
    dot: "bg-tan",
  },
};

/* the instant, glanceable verdict flashed big over the camera the moment a
   scan resolves — gate staff read it at arm's length, then glance at the
   detail card below. "ERROR" covers a scan/network hiccup (question mark). */
type FlashKind = ScanEvent["result"] | "ERROR";
const FLASH_META: Record<
  FlashKind,
  { icon: typeof CheckCircle2; label: string; ring: string }
> = {
  ACCEPTED: { icon: CheckCircle2, label: "Verified", ring: "bg-green/20 text-green ring-green/50" },
  ALREADY_USED: { icon: Ban, label: "Already used", ring: "bg-terracotta/20 text-terracotta ring-terracotta/50" },
  REVOKED: { icon: ShieldX, label: "Revoked", ring: "bg-terracotta/20 text-terracotta ring-terracotta/50" },
  INVALID: { icon: XCircle, label: "Invalid", ring: "bg-terracotta/20 text-terracotta ring-terracotta/50" },
  EXPIRED: { icon: Hourglass, label: "Expired", ring: "bg-tan/20 text-tan ring-tan/50" },
  ERROR: { icon: HelpCircle, label: "Try again", ring: "bg-cream/10 text-cream ring-cream/30" },
};

/* turn a getUserMedia failure into a message the gate staff can act on */
function describeCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera access is blocked. Allow the camera for this site in your browser settings, then reload.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera was found on this device.";
    case "NotReadableError":
    case "AbortError":
      return "The camera is being used by another app. Close it and try again.";
    default:
      return err instanceof Error && err.message
        ? `Could not start the camera: ${err.message}`
        : "Could not start the camera — it needs HTTPS (or localhost) and camera permission.";
  }
}

const FEED_KEY = ["gate-feed"];
const FEED_LIMIT = 30;

const timeOf = formatEventTime;
const dateTimeOf = formatEventDateTime;

/* the one-line verdict explanation: when it was used, when it expires */
function verdictDetail(e: FeedItem): string {
  switch (e.result) {
    case "ACCEPTED":
      return `Checked in at ${timeOf(e.usedAt ?? e.at)}${
        e.expiresAt ? ` · pass valid until ${dateTimeOf(e.expiresAt)}` : ""
      }`;
    case "ALREADY_USED":
      return e.usedAt
        ? `This pass was already used at ${dateTimeOf(e.usedAt)} — entry denied.`
        : "This pass has already been used — entry denied.";
    case "EXPIRED":
      return e.expiresAt
        ? `The event ended ${dateTimeOf(e.expiresAt)} — this pass is no longer valid.`
        : "This event has ended — the pass is no longer valid.";
    case "REVOKED":
      return "This pass was revoked by an admin.";
    case "INVALID":
      return "This code is not one of our signed tickets.";
  }
}

/* Continuous camera decoding; only server verification is serialized. */
export default function Scanner({
  role,
  profile,
}: {
  role: Role;
  profile?: { name?: string | null; email?: string | null };
}) {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<FeedItem | null>(null);
  const [flash, setFlash] = useState<{ id: number; kind: FlashKind } | null>(null);
  const [scanSession] = useState(() => new ScanSession());
  const [cameraSession] = useState(() => new CameraSession());
  const [cameraState, setCameraState] = useState<"starting" | "running" | "error">("starting");
  const [cameraError, setCameraError] = useState("");
  const [restartCount, setRestartCount] = useState(0);
  const [cameraId, setCameraId] = useState("");
  const [activeDevice, setActiveDevice] = useState("");
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [online, setOnline] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeRef = useRef<QrScanner | null>(null);
  const queryClient = useQueryClient();

  /* the feed lives in the query cache so it survives tab switches */
  const { data: feed = [] } = useQuery<FeedItem[]>({
    queryKey: FEED_KEY,
    queryFn: () => [],
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const pushToFeed = (event: FeedItem) => {
    queryClient.setQueryData<FeedItem[]>(FEED_KEY, (old = []) => {
      if (old.some((e) => e.at === event.at)) return old.map((e) => e.at === event.at ? { ...e, ...event } : e);
      return [event, ...old].slice(0, FEED_LIMIT);
    });
  };

  const scan = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: async (qr: string) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      try {
        return await api<ScanResponse>("/api/scan", {
          role, body: { qr }, signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    },
    onSuccess: (res) => {
      setError("");
      const item = res;
      setLatest(item);
      pushToFeed(item);
      setFlash({ id: Date.now(), kind: res.result });
      try { navigator.vibrate?.(res.result === "ACCEPTED" ? 70 : [60, 50, 60]); } catch { /* optional feedback */ }
    },
    onError: (err) => {
      setLatest(null);
      scanSession.release(true);
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      setError(timedOut
        ? "Verification timed out. The pass may already be checked in. Present it again to confirm its status."
        : err instanceof Error ? err.message : "Connection failed. Present the ticket again.");
      setFlash({ id: Date.now(), kind: "ERROR" });
      try { navigator.vibrate?.([60, 50, 60]); } catch { /* optional feedback */ }
    },
    onSettled: () => scanSession.release(),
  });

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Feedback never pauses the decoder or delays the next attendee.
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 650);
    return () => clearTimeout(timer);
  }, [flash]);
  const scanRef = useRef(scan);
  useEffect(() => {
    scanRef.current = scan;
  }, [scan]);

  /* live feed from every gate */
  useEffect(() => {
    return subscribeLive(role, { onScan: pushToFeed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (!scanning || !videoRef.current) return;
    const video = videoRef.current;
    let cancelled = false;
    let removeTrackListener = () => {};
    setCameraState("starting");
    setCameraError("");
    setHasTorch(false);
    setTorchOn(false);

    const opening = cameraSession.start(() => {
      // The engine is initialized below after its browser-only module loads.
      let scanner: QrScanner | null = null;
      let destroyed = false;
      return {
        start: async () => {
          const { default: Engine } = await import("qr-scanner");
          if (cancelled || destroyed) return;
          if (!window.isSecureContext) throw new DOMException("HTTPS is required", "SecurityError");
          scanner = new Engine(video, (result) => {
            if (cancelled || !navigator.onLine || !scanSession.claim(result.data)) return;
            setFlash(null);
            setError("");
            scanRef.current.mutate(result.data);
          }, {
            preferredCamera: cameraId || "environment",
            returnDetailedScanResult: true,
            maxScansPerSecond: 25,
            // Decode the full camera frame without a digital zoom or cropped preview.
            calculateScanRegion: (source) => {
              const width = source.videoWidth;
              const height = source.videoHeight;
              const scale = Math.min(1, 720 / Math.max(width, height));
              return { x: 0, y: 0, width, height,
                downScaledWidth: Math.round(width * scale),
                downScaledHeight: Math.round(height * scale) };
            },
            onDecodeError: () => {}, // No code in this frame is normal.
          });
          activeRef.current = scanner;
          await scanner.start();
          if (cancelled || destroyed) { scanner.destroy(); return; }
          const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
          if (track) {
            const caps = track.getCapabilities?.() as (MediaTrackCapabilities & {
              focusMode?: string[]; zoom?: { min: number; max: number };
            }) | undefined;
            const advanced: (MediaTrackConstraintSet & { focusMode?: string; zoom?: number })[] = [];
            if (caps?.focusMode?.includes("continuous")) advanced.push({ focusMode: "continuous" });
            // Explicitly return telephoto-capable devices to their natural 1x view.
            if (caps?.zoom && caps.zoom.min <= 1 && caps.zoom.max >= 1) advanced.push({ zoom: 1 });
            if (advanced.length) void track.applyConstraints({ advanced }).catch(() => {});
            setActiveDevice(track.getSettings().deviceId ?? "");
            const ended = () => { if (!cancelled) setRestartCount((count) => count + 1); };
            track.addEventListener("ended", ended);
            removeTrackListener = () => track.removeEventListener("ended", ended);
          }
          setCameraState("running");
          void Engine.listCameras().then((devices) => { if (!cancelled) setCameras(devices); }).catch(() => {});
          void scanner.hasFlash().then((available) => { if (!cancelled) setHasTorch(available); }).catch(() => {});
        },
        destroy: () => {
          if (destroyed) return;
          destroyed = true;
          removeTrackListener();
          // Release the hardware immediately; the library's default stop delays
          // stream teardown for 300ms to support pause/resume.
          void scanner?.pause(true).catch(() => {});
          scanner?.destroy();
          if (activeRef.current === scanner) activeRef.current = null;
        },
      };
    });
    void opening.catch((err) => {
      if (!cancelled) {
        setCameraState("error");
        setCameraError(describeCameraError(err));
      }
    });
    return () => {
      cancelled = true;
      removeTrackListener();
      cameraSession.stop();
    };
  }, [scanning, cameraId, restartCount, cameraSession, scanSession]);

  const scannerInitials = (profile?.name ?? "S")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-5xl space-y-5 text-left">
      {/* who's on the gate — the signed-in scanner's profile */}
      {profile && (
        <Panel className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange/15 text-sm font-bold text-orange">
            {scannerInitials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-cream">
              {profile.name ?? "Gate scanner"}
            </p>
            {profile.email && (
              <p className="truncate text-xs text-cream-dim">{profile.email}</p>
            )}
          </div>
          <span className={cn("ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold", online ? "bg-green/15 text-green" : "bg-terracotta/15 text-terracotta")}>
            {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {online ? "Connected" : "Offline"}
          </span>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Panel className="flex items-center gap-3 !p-4"><CheckCircle2 className="size-5 shrink-0 text-green" /><div><p className="text-2xl font-semibold tabular-nums text-cream">{feed.filter((item) => item.result === "ACCEPTED").length}</p><p className="text-xs text-cream-dim">Admitted · recent activity</p></div></Panel>
        <Panel className="flex items-center gap-3 !p-4"><ShieldX className="size-5 shrink-0 text-orange" /><div><p className="text-2xl font-semibold tabular-nums text-cream">{feed.filter((item) => item.result !== "ACCEPTED").length}</p><p className="text-xs text-cream-dim">Flagged · recent activity</p></div></Panel>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-4 lg:sticky lg:top-5">

      {/* the camera container stays mounted; CSS hides it when idle */}
      <Panel className={scanning ? "" : "hidden"}>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold text-cream"><ScanLine className="size-5 text-orange" />Scan a ticket</h2><span className="text-xs text-cream-dim">{cameraState === "running" ? "Camera ready" : cameraState === "error" ? "Camera unavailable" : "Starting camera"}</span></div>
        <div className="relative mx-auto w-full overflow-hidden rounded-xl border border-line bg-black">
          <video key={`${restartCount}:${cameraId}:${scanning}`} ref={videoRef} muted playsInline aria-label="Live ticket scanner camera"
            className="aspect-[4/3] w-full rounded-lg bg-black object-contain" />
          {cameraState === "running" && <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/60 shadow-[0_0_0_100px_#0003]" />}
          {cameraState === "starting" && <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg border border-line bg-panel/95 text-cream"><Spinner />Opening camera…</div>}
          {/* Keep the view unobstructed while the server verifies entry. */}
          <AnimatePresence>
            {scan.isPending && !flash && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex items-center justify-center gap-2 rounded-lg border border-line bg-panel/95 p-3 shadow-sm"
              >
                <span className="flex size-8 items-center justify-center">
                  <Spinner className="h-6 w-6 text-orange" />
                </span>
                <span className="text-sm font-semibold text-cream">Checking ticket…</span>
              </motion.div>
            )}
          </AnimatePresence>
          <ScanFlash flash={flash} />
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-xs text-cream-dim">
          {!online ? "Offline — reconnect before admitting attendees." : scan.isPending
            ? "Code captured — verifying the pass."
            : cameraState === "running" ? "Ready for the next ticket · 1× view · One entry per pass." : "Start or restart the camera to scan tickets."}
        </p>
        {cameraError && <Note tone="error">{cameraError}</Note>}
        {cameras.length > 1 && <label className="mt-3 block text-left text-xs text-cream-dim">
          Camera
          <select aria-label="Scanner camera" value={cameraId || activeDevice}
            onChange={(event) => setCameraId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-panel-2 p-2 text-sm text-cream">
            {cameras.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}
          </select>
        </label>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => setScanning(false)}>
            <CameraOff className="size-4" /> Stop
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={() => setRestartCount((count) => count + 1)}>
            <RefreshCw className="size-4" /> Restart camera
          </Button>
          {hasTorch && <Button variant="outline" aria-pressed={torchOn} onClick={async () => {
            try {
              await activeRef.current?.toggleFlash();
              setTorchOn(activeRef.current?.isFlashOn() ?? false);
            } catch { setCameraError("The camera light is unavailable on this device."); }
          }}><Flashlight className="size-4" />{torchOn ? "Light off" : "Light on"}</Button>}
        </div>
      </Panel>
      {!scanning && (
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={() => {
            setError("");
            setScanning(true);
          }}
        >
          <Camera className="size-4" /> Start scanning
        </Button>
      )}
      <div className="rounded-xl border border-line bg-panel/50 p-4 text-xs leading-relaxed text-cream-dim"><p className="mb-1 font-semibold text-cream">At the entrance</p>Hold the full QR code inside the frame. Wait for the result before admitting anyone. A green result admits one person; used, revoked or expired tickets must be reviewed.</div>
      <ManualTicketCheck role={role} />
      </div>
      <div className="space-y-4">

      {/* latest verdict, big and unmissable */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{latest ? `${RESULT_STYLE[latest.result].label}. ${latest.attendee?.fullName ?? ""}` : error}</div>
      <AnimatePresence mode="popLayout">
        {latest && (
          <motion.div
            key={latest.at}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <VerdictCard item={latest} />
          </motion.div>
        )}
      </AnimatePresence>
      {!latest && <Panel className="flex min-h-44 flex-col items-center justify-center gap-3 text-center"><ScanLine className="size-9 text-orange" aria-hidden="true" /><div><h2 className="font-semibold text-cream">Ready for check-in</h2><p className="mt-1 text-sm text-cream-dim">The attendee and entry result will appear here.</p></div></Panel>}

      {/* live gate feed, newest first */}
      {feed.length > 0 && (
        <Panel>
          <h3 className="label mb-3 flex items-center gap-2 text-xs font-bold text-orange">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-green opacity-60" />
              <span className="h-2 w-2 rounded-full bg-green" />
            </span>
            All gates · live activity (Kigali time)
          </h3>
          <ul className="space-y-2">
            {feed.slice(0, 7).map((e) => (
              <li key={e.at} className="flex items-center gap-2.5 text-sm">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", RESULT_STYLE[e.result].dot)} />
                <span className="min-w-0 flex-1 truncate text-cream">
                  {e.attendee?.fullName ?? "Unknown ticket"}
                </span>
                <Badge
                  variant="outline"
                  className={cn("border-0 text-[10px] font-bold", {
                    "bg-green/15 text-green": e.result === "ACCEPTED",
                    "bg-terracotta/15 text-terracotta":
                      e.result === "ALREADY_USED" || e.result === "REVOKED" || e.result === "INVALID",
                    "bg-tan/15 text-tan": e.result === "EXPIRED",
                  })}
                >
                  {RESULT_STYLE[e.result].label}
                </Badge>
                <span className="shrink-0 text-xs text-cream-dim">{timeOf(e.at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {feed.length === 0 && <Panel><h3 className="flex items-center gap-2 font-semibold text-cream"><Activity className="size-4 text-orange" />Gate activity</h3><p className="mt-3 text-sm text-cream-dim">No scans yet. Activity from all gates will appear here.</p></Panel>}

      {error && <Note tone="error">{error}</Note>}
      </div>
      </div>
    </div>
  );
}

type TicketCheck = {
  valid: boolean;
  reason?: string | null;
  message?: string;
  ticket?: { ticketNumber: string; holderName: string; holderType: string; eventName: string | null; scannedAt: string | null; expiresAt: string | null };
};

function ManualTicketCheck({ role }: { role: Role }) {
  const [code, setCode] = useState("");
  const check = useMutation({
    mutationFn: (value: string) => api<TicketCheck>("/api/tickets/validate", { role, body: { code: value } }),
  });
  return (
    <Panel>
      <h3 className="font-semibold text-cream">Check a ticket without admitting</h3>
      <p className="mt-1 text-xs text-cream-dim">Camera unavailable? Look up the printed ticket number. This check does not use the pass.</p>
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (!check.isPending && code.trim()) check.mutate(code.trim());
      }}>
        <label htmlFor="manual-ticket-code" className="sr-only">Ticket number or code</label>
        <Input id="manual-ticket-code" value={code} onChange={(event) => { setCode(event.target.value); check.reset(); }} placeholder="e.g. WTN-000042" autoComplete="off" className="min-w-0 flex-1 font-mono" required minLength={6} maxLength={200} />
        <Button type="submit" variant="outline" disabled={check.isPending || code.trim().length < 6}>{check.isPending ? "Checking…" : "Check ticket"}</Button>
      </form>
      <div aria-live="polite" className="mt-3 text-sm">
        {check.error && <Note tone="error">{check.error.message}</Note>}
        {check.data && <div className={cn("rounded-lg border p-3", check.data.valid ? "border-green text-green" : "border-terracotta text-cream")}>
          <p className="font-semibold">{check.data.valid ? "Valid · not checked in" : check.data.message ?? check.data.reason?.replaceAll("_", " ") ?? "Not valid"}</p>
          {check.data.ticket && <>
            <p className="mt-1 text-cream">{check.data.ticket.holderName} · {check.data.ticket.ticketNumber}</p>
            <p className="text-cream-dim">{check.data.ticket.eventName}</p>
            {check.data.ticket.scannedAt && <p className="text-cream-dim">Used {formatEventDateTime(check.data.ticket.scannedAt)} (Kigali)</p>}
            {check.data.ticket.expiresAt && <p className="text-cream-dim">Entry closes {formatEventDateTime(check.data.ticket.expiresAt)} (Kigali)</p>}
          </>}
          {check.data.valid && <p className="mt-2 text-xs text-cream-dim">Scan the QR above when you are ready to admit the attendee.</p>}
        </div>}
      </div>
    </Panel>
  );
}

/* the big verdict that flashes over the live camera the instant a scan
   resolves — a tick for a clean entry, an X for invalid/revoked, a "used"
   stamp for a re-scan, and a question mark when the scan itself hiccups */
function ScanFlash({ flash }: { flash: { id: number; kind: FlashKind } | null }) {
  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          key={flash.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex items-center justify-center gap-3 rounded-lg border border-line bg-panel/95 p-3 shadow-sm"
        >
          {(() => {
            const meta = FLASH_META[flash.kind];
            const Icon = meta.icon;
            return (
              <>
                <motion.span
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 480, damping: 20 }}
                  className={cn("flex size-10 items-center justify-center rounded-full ring-2", meta.ring)}
                >
                  <Icon className="size-7" strokeWidth={2.5} />
                </motion.span>
                <span className="text-lg font-semibold text-cream">{meta.label}</span>
              </>
            );
          })()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function VerdictCard({ item }: { item: FeedItem }) {
  const style = RESULT_STYLE[item.result];
  const Icon = style.icon;
  return (
    <Panel className={cn("border-2", style.className)}>
      <div className="flex items-center gap-3">
        <Icon className={cn("size-9 shrink-0", style.iconClass)} />
        <p className={cn("display text-2xl", style.iconClass)}>{style.label}</p>
      </div>

      {item.attendee && (
        <div className="mt-4 flex items-center gap-3">
          {item.attendee.photoUrl && (
            <img
              src={item.attendee.photoUrl}
              alt=""
              className="h-14 w-14 rounded-full border border-line object-cover"
            />
          )}
          <div className="text-sm text-cream">
            <p className="font-semibold">{item.attendee.fullName}</p>
            <p className="text-cream-dim">
              {item.attendee.type === "PLUS_ONE" ? "GUEST" : item.attendee.type}
              {item.eventName ? ` · ${item.eventName}` : ""}
            </p>
          </div>
        </div>
      )}

      <p className="mt-3 flex items-start gap-2 text-sm text-cream-dim">
        <Clock className="mt-0.5 size-4 shrink-0" />
        {verdictDetail(item)}
      </p>

      {/* the frame captured the instant this ticket was scanned */}
      {item.snapshot && (
        <div className="mt-4">
          <p className="label mb-1.5 text-[10px] font-semibold text-cream-dim">Gate snapshot</p>
          <img
            src={item.snapshot}
            alt="Frame captured at scan time"
            className="max-h-40 w-full rounded-lg border border-line object-cover"
          />
        </div>
      )}
    </Panel>
  );
}
