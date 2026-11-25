/* Fetch an image URL (or decode a data: URL) into a Buffer, tolerating failure.
   Used by the ticket PDF/email builders to embed profile photos and event
   posters. A slow or unreachable image must never hang the request or break the
   pass, so this always resolves — returning null when the image can't be had. */

const DEFAULT_TIMEOUT_MS = 5_000;
const images = new Map<string, { until: number; value: Promise<Buffer | null>; bytes: number }>();
let cachedBytes = 0;

function forget(key: string) {
  cachedBytes -= images.get(key)?.bytes ?? 0;
  images.delete(key);
}

export async function fetchImageBuffer(
  url: string | null | undefined,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Buffer | null> {
  if (!url) return null;

  if (url.startsWith("data:")) {
    try {
      const base64 = url.split(",")[1] ?? "";
      return Buffer.from(base64, "base64");
    } catch {
      return null;
    }
  }

  const key = `${timeoutMs}:${url}`;
  const cached = images.get(key);
  if (cached && cached.until > Date.now()) return cached.value;
  forget(key);
  const entry = { until: Date.now() + 60_000, value: downloadImage(url, timeoutMs), bytes: 0 };
  images.set(key, entry);
  while (images.size > 24) forget(images.keys().next().value!);
  const image = await entry.value;
  if (images.get(key) === entry) {
    if (!image || image.length > 4 * 1024 * 1024) forget(key);
    else {
      entry.bytes = image.length;
      cachedBytes += image.length;
      while (cachedBytes > 16 * 1024 * 1024) forget(images.keys().next().value!);
    }
  }
  return image;
}

async function downloadImage(url: string, timeoutMs: number): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    /* timeout, network error, or abort — the pass renders fine without it */
    return null;
  } finally {
    clearTimeout(timer);
  }
}
