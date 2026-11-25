/* Browser-side helpers: role-aware JSON fetch with auth + localStorage
   persistence for the long-lived roles (admin/scanner). The participant token
   lives only in Redux memory and is refreshed via the httpOnly cookie. */

import type { Role } from "@/store/authSlice";
import { bridgeGetToken, bridgeOnUnauthorized, bridgeRefresh } from "./authBridge";
import { prepareImageUpload } from "./prepareImageUpload";

/* localStorage keys — only admin & scanner persist here (they carry long
   bearer tokens); the participant relies on the refresh cookie instead. */
export const STORAGE_KEYS = {
  admin: { token: "iems_admin_token", role: "iems_admin_role", name: "iems_admin_name" },
  scanner: { token: "iems_scanner_token", name: "iems_scanner_name" },
} as const;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  /** which signed-in role to authenticate as (token resolved from the store) */
  role?: Role;
  form?: FormData;
  /** send/receive cookies (needed for the refresh endpoint) */
  credentials?: RequestCredentials;
  signal?: AbortSignal;
};

async function rawFetch(path: string, opts: ApiOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  return fetch(path, {
    method: opts.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    credentials: opts.credentials,
    signal: opts.signal,
  });
}

async function request(path: string, opts: ApiOptions): Promise<Response> {
  if (opts.form && (["/api/admin/uploads", "/api/me/photo"].includes(path) || /^\/api\/admin\/events\/[^/]+\/poster$/.test(path))) {
    const form = new FormData();
    for (const [key, value] of opts.form) {
      try { form.append(key, value instanceof File ? await prepareImageUpload(value) : value); }
      catch (error) { throw new ApiError(error instanceof Error ? error.message : "Invalid image", 400); }
    }
    opts = { ...opts, form, signal: opts.signal ?? AbortSignal.timeout(75_000) };
  }
  const token = opts.role ? bridgeGetToken(opts.role) : null;
  let res = await rawFetch(path, opts, token);

  /* one transparent recovery attempt on 401 */
  if (res.status === 401 && opts.role) {
    if (opts.role === "participant") {
      const fresh = await bridgeRefresh();
      if (fresh) {
        res = await rawFetch(path, opts, fresh);
      }
      if (res.status === 401) bridgeOnUnauthorized(opts.role);
    } else {
      bridgeOnUnauthorized(opts.role);
    }
  }

  return res;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await request(path, opts).catch((error) => {
    if (opts.form && error instanceof Error && error.name === "TimeoutError") throw new ApiError("Image upload timed out. Please check your connection and try again.", 504);
    throw error;
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? "Something went wrong", res.status);
  }
  return data as T;
}

/** Binary ticket downloads share the JSON client's role and refresh behavior. */
export async function apiBlob(path: string, opts: ApiOptions = {}): Promise<Blob> {
  const res = await request(path, opts);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError((data as { error?: string }).error ?? "Could not load the ticket", res.status);
  }
  return res.blob();
}
