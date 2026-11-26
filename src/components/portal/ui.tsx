import { Button as SdkButton } from "@ui-sdk/react/button";
import {
  Select as SdkSelect,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import { Check, ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import Image from "next/image";
import Link from "next/link";

/* Shared building blocks for the ticketing/admin portal, using the same
   design tokens as the landing page */

export function PortalShell({
  title,
  eyebrow,
  children,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Image src="/iro-logo.svg" alt="" width={44} height={44} className="h-11 w-11" />
        <span className="display text-xl text-cream">Igire Rwanda</span>
      </Link>
      <div className={`w-full ${wide ? "max-w-4xl" : "max-w-md"} text-center`}>
        {eyebrow && <p className="label mb-2 text-xs font-semibold text-orange">{eyebrow}</p>}
        <h1 className="display mb-6 text-3xl text-cream sm:text-4xl">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-panel p-6 text-left ${className}`}>
      {children}
    </div>
  );
}

/* Brand SVG spinner — the waiting indicator across the portal */
export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`animate-spin ${className}`}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Full-panel waiting state: spinner + message, centered */
export function Waiting({ message }: { message: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 py-10 text-center">
      <Spinner className="h-10 w-10 text-orange" />
      <p className="text-sm text-cream-dim">{message}</p>
    </div>
  );
}

export function SuccessIcon({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <circle cx="24" cy="24" r="22" fill="#6fa84c" fillOpacity="0.15" />
      <circle cx="24" cy="24" r="22" stroke="#6fa84c" strokeWidth="2.5" />
      <path
        d="M15 24.5l6.5 6.5L33 18"
        stroke="#6fa84c"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ErrorIcon({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <circle cx="24" cy="24" r="22" fill="#c05a2e" fillOpacity="0.15" />
      <circle cx="24" cy="24" r="22" stroke="#c05a2e" strokeWidth="2.5" />
      <path
        d="M17 17l14 14M31 17l-14 14"
        stroke="#c05a2e"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Pulsing placeholder bar for skeleton layouts */
export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-panel-2 ${className}`} />;
}

export function Field({
  label,
  className = "",
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-left">
      <span className="label mb-1.5 block text-xs font-semibold text-cream-dim">{label}</span>
      <input
        {...props}
        className={`w-full rounded-lg border border-line bg-panel-2 px-3.5 py-2.5 text-cream transition-colors placeholder:text-cream-dim/60 focus:outline-none ${className}`}
      />
    </label>
  );
}

export function Select<T extends string>({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  required,
  disabled,
  name,
}: {
  label: string;
  value: T | "";
  onValueChange: (value: T) => void;
  options: readonly (readonly [T, string])[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <SdkSelect<T>
      value={value === "" ? null : value}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      items={options.map(([v, text]) => ({ value: v, label: text }))}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      name={name}
    >
      <div className="block text-left">
        <SelectLabel className="label mb-1.5 block text-xs font-semibold text-cream-dim">
          {label}
        </SelectLabel>
        <SelectTrigger className="flex h-auto w-full items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-3.5 py-2.5 text-left text-cream transition-colors hover:border-orange/60 focus-visible:border-orange focus-visible:outline-none data-[open]:border-orange data-[placeholder]:text-cream-dim/70">
          <SelectValue className="truncate" />
          <ChevronDown className="size-4 shrink-0 text-cream-dim transition-transform in-data-[open]:rotate-180" aria-hidden="true" />
        </SelectTrigger>
        <SelectContent
          sideOffset={6}
          className="w-(--anchor-width) max-h-(--available-height) overflow-y-auto rounded-xl border border-line bg-panel-2 p-1.5 text-cream shadow-2xl shadow-black/40"
        >
          {options.map(([v, text]) => (
            <SelectItem
              key={v}
              value={v}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-cream outline-none transition-colors data-[highlighted]:bg-orange/15 data-[highlighted]:text-orange data-[selected]:font-semibold data-[selected]:text-orange"
            >
              {text}
              <SelectItemIndicator>
                <Check className="size-4 text-orange" aria-hidden="true" />
              </SelectItemIndicator>
            </SelectItem>
          ))}
        </SelectContent>
      </div>
    </SdkSelect>
  );
}

export function Button({
  children,
  variant = "primary",
  busy = false,
  ...props
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  /** shows the spinner and disables the button */
  busy?: boolean;
} & Omit<ComponentProps<typeof SdkButton>, "children">) {
  const styles =
    variant === "primary"
      ? "border border-transparent bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      : "border border-line text-cream hover:border-orange hover:text-orange disabled:opacity-50";
  return (
    <SdkButton
      {...props}
      disabled={busy || props.disabled}
      className={`public-action portal-button inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] ${styles} ${props.className ?? ""}`}
    >
      {busy && <Spinner className="h-4 w-4" />}
      {children}
    </SdkButton>
  );
}

export function Note({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const color =
    tone === "error" ? "text-terracotta" : tone === "success" ? "text-green" : "text-cream-dim";
  return <p className={`mt-3 text-sm ${color}`}>{children}</p>;
}

export function StatusBadge({ value }: { value: string }) {
  const tone: Record<string, string> = {
    PENDING: "bg-panel-2 text-cream-dim",
    VERIFIED: "bg-tan/20 text-tan",
    COMPLETE: "bg-green/20 text-green",
    VALID: "bg-green/20 text-green",
    USED: "bg-panel-2 text-cream-dim",
    REVOKED: "bg-terracotta/20 text-terracotta",
    EXPIRED: "bg-tan/20 text-tan",
    OPEN: "bg-green/20 text-green",
    DRAFT: "bg-panel-2 text-cream-dim",
    CLOSED: "bg-terracotta/20 text-terracotta",
  };
  return (
    <span className={`label rounded-md px-2 py-0.5 text-[10px] font-bold ${tone[value] ?? "bg-panel-2 text-cream-dim"}`}>
      {value}
    </span>
  );
}
