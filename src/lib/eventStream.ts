type StreamHandlers = {
  onConnecting?: () => void;
  onOpen?: () => void;
  onMessage?: (event: MessageEvent) => void;
  onNotification?: (event: MessageEvent) => void;
  onHeartbeat?: () => void;
  onError?: () => void;
};

export function openEventStream(url: string, handlers: StreamHandlers) {
  let source: EventSource;
  let stopped = false;
  let retryDelay = 1_000;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stable: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  function alive() {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => source.onerror?.(new Event("error")), 60_000);
  }

  function connect() {
    handlers.onConnecting?.();
    source = new EventSource(url);
    source.onopen = () => {
      alive();
      stable = setTimeout(() => { retryDelay = 1_000; }, 30_000);
      handlers.onOpen?.();
    };
    source.onmessage = (event) => { alive(); handlers.onMessage?.(event); };
    source.addEventListener("heartbeat", () => { alive(); handlers.onHeartbeat?.(); });
    source.addEventListener("notification", (event) => { alive(); handlers.onNotification?.(event as MessageEvent); });
    source.onerror = () => {
      // Own retries so a failing endpoint cannot trigger a tight native reconnect loop.
      source.close();
      clearTimeout(stable);
      clearTimeout(watchdog);
      if (stopped) return;
      handlers.onError?.();
      retry = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    };
  }

  connect();
  return {
    close() {
      stopped = true;
      clearTimeout(retry);
      clearTimeout(stable);
      clearTimeout(watchdog);
      source.close();
    },
  };
}
