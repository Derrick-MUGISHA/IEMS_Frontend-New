import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import { Agent } from "node:https";

const uploadAgent = new Agent({ keepAlive: true, maxSockets: 4 });

/* Content-sniff the bytes before we trust them: the client-declared MIME type
   is not authoritative, so decode the header with sharp and require a real
   raster image in a known format. Throws on anything sharp can't parse. */
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "tiff"]);

export class InvalidImageError extends Error {
  constructor() {
    super("The uploaded file is not a valid image");
    this.name = "InvalidImageError";
  }
}

export class ImageUploadError extends Error {
  readonly status: number;
  constructor(error: unknown) {
    const failure = error as { code?: string; http_code?: number };
    const timeout = failure?.code === "ETIMEDOUT" || failure?.http_code === 499;
    super(timeout ? "Image upload timed out. Please check your connection and try again." : "The image service could not complete the upload. Please try again.", { cause: error });
    this.name = "ImageUploadError";
    this.status = timeout ? 504 : 502;
  }
}

export async function prepareCloudinaryImage(buffer: Buffer): Promise<Buffer> {
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new InvalidImageError();
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format) || !meta.width || !meta.height) {
    throw new InvalidImageError();
  }
  if (meta.pages && meta.pages > 1) return buffer;
  try {
    const compact = await sharp(buffer).rotate().resize(800, 800, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85, effort: 3 }).toBuffer();
    return compact.length < buffer.length ? compact : buffer;
  } catch { throw new InvalidImageError(); }
}

/* Configure lazily on first use so the credentials are read at call time —
   the app injects env before modules run, but the seed (tsx) loads .env.local
   after the hoisted imports evaluate, so top-level config would miss them. */
let configured = false;
function ensureConfigured() {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

function uploadOnce(buffer: Buffer, folder: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let stream: ReturnType<typeof cloudinary.uploader.upload_stream> | undefined;
    let settled = false;
    const finish = (error?: unknown, url?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error || !url) reject(error ?? new Error("Image upload failed"));
      else resolve(url);
    };
    const timer = setTimeout(() => {
      finish(Object.assign(new Error("Image upload timed out. Please try again."), { code: "ETIMEDOUT" }));
      stream?.destroy();
    }, 30_000);
    try {
      stream = cloudinary.uploader
        .upload_stream(
          {
            folder: `iems/${folder}`,
            resource_type: "image",
            transformation: [{ width: 800, height: 800, crop: "limit" }],
            timeout: 25_000,
            agent: uploadAgent,
          },
          (err, res) => finish(err, res?.secure_url)
        );
      stream.on("error", (error) => finish(error));
      stream.end(buffer);
    } catch (error) { finish(error); }
  });
}

/* liveness check for the health-check script — resolves the account status
   without uploading anything. Throws on auth/connectivity failure. */
export async function pingCloudinary(): Promise<{ status: string }> {
  ensureConfigured();
  return cloudinary.api.ping();
}

export async function uploadImage(buffer: Buffer, folder: string): Promise<string> {
  ensureConfigured();
  /* reject non-images (or corrupt files) before they ever reach Cloudinary */
  const compact = await prepareCloudinaryImage(buffer);
  try {
    return await uploadOnce(compact, folder);
  } catch (error) {
    const failure = error as { http_code?: number; code?: string };
    if (![429, 500, 502, 503, 504].includes(failure.http_code ?? 0) && !["ECONNRESET", "EPIPE", "EAI_AGAIN"].includes(failure.code ?? "")) throw new ImageUploadError(error);
    try { return await uploadOnce(compact, folder); }
    catch (retryError) { throw new ImageUploadError(retryError); }
  }
}
