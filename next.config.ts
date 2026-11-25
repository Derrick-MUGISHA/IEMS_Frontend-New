import type { NextConfig } from "next";

/* Baseline security headers applied to every response. The CSP is deliberately
   moderate: it locks down framing, base-uri, object/embed and form targets, and
   confines connect/img/font sources, while still allowing the inline styles and
   scripts Next's App Router + the Three.js hero need. Tightening script-src with
   per-request nonces (removing 'unsafe-inline'/'unsafe-eval') is tracked as a
   post-v1 hardening item. */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  serverExternalPackages: ["pdfkit", "sharp", "cloudinary"],
  // outputFileTracingIncludes removed — serverExternalPackages handles sharp
  outputFileTracingRoot: __dirname,
  outputFileTracingIncludes: {
    "/api/**/*": ["./public/fonts/tickets/*.ttf"],
  },
  allowedDevOrigins: ["events.igirerwanda.org", ...(process.env.NEXT_PUBLIC_APP_URL ? [new URL(process.env.NEXT_PUBLIC_APP_URL).hostname] : [])],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
