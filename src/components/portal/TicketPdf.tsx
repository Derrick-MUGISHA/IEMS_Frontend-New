"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, RefreshCw } from "lucide-react";
import { apiBlob } from "@/lib/client";
import type { Role } from "@/store/authSlice";
import { Button } from "@/components/ui/button";
import { TicketArtwork, TicketArtworkSkeleton, type TicketArtworkData } from "@/components/admin/TicketArtwork";

export function TicketSkeleton() {
  return <section role="status" aria-label="Loading your ticket" className="w-full space-y-3 text-left">
    <div className="flex flex-wrap gap-2"><div className="h-10 w-36 animate-pulse rounded-md bg-panel-2" /><div className="h-10 w-32 animate-pulse rounded-md bg-panel-2" /></div>
    <div className="overflow-hidden rounded-xl border border-border bg-muted"><TicketArtworkSkeleton /></div>
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-panel p-5 sm:hidden"><div className="h-4 w-24 animate-pulse rounded bg-panel-2" /><div className="size-56 animate-pulse rounded bg-panel-2" /><div className="h-4 w-40 animate-pulse rounded bg-panel-2" /></div>
    <div className="h-4 w-3/4 animate-pulse rounded bg-panel-2" />
  </section>;
}

export function TicketPdf({ src, role, revision = "", filename = "ticket.pdf", preview }: {
  src: string; role?: Role; revision?: string; filename?: string; preview?: TicketArtworkData;
}) {
  const [document, setDocument] = useState<{ blob: Blob; url: string } | null>(null);
  const appearance = { ...preview, qr: undefined };
  const pdf = useQuery({
    queryKey: ["ticket-pdf", "plain-qr-v1", role ?? "public", src, revision, appearance],
    queryFn: ({ signal }) => apiBlob(src, { role, signal }),
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    meta: { persist: false },
  });
  const url = document?.blob === pdf.data ? document?.url ?? null : null;
  useEffect(() => {
    if (!pdf.data) { setDocument(null); return; }
    const objectUrl = URL.createObjectURL(pdf.data);
    setDocument({ blob: pdf.data, url: objectUrl });
    return () => URL.revokeObjectURL(objectUrl);
  }, [pdf.data]);

  if (!preview && !url && !pdf.error) return <TicketSkeleton />;
  return (
    <section aria-label="Ticket" className="w-full space-y-3 text-left">
      <div className="flex flex-wrap gap-2">
        {url ? <>
          <Button asChild><a href={url} download={filename}><Download className="size-4" />Download ticket</a></Button>
          <Button variant="outline" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />Open ticket</a></Button>
        </> : <>
          <Button disabled><Download className="size-4" />Preparing PDF…</Button>
          <Button variant="outline" disabled><ExternalLink className="size-4" />Open ticket</Button>
        </>}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-muted">
        {preview ? <TicketArtwork ticket={preview} /> : url ? <iframe title="Event ticket" src={`${url}#toolbar=0&view=FitH`} className="aspect-[2/1] w-full" /> : <TicketArtworkSkeleton />}
      </div>
      {preview?.qr && <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-panel p-5 text-center sm:hidden">
        <h2 className="font-semibold text-cream">Entry QR</h2>
        <Image src={preview.qr} alt="Large entry QR for scanning" width={224} height={224} unoptimized className="size-56 bg-white [image-rendering:pixelated]" />
        <p className="text-sm text-cream">{preview.name} · {preview.number}</p>
        <p className="text-xs text-cream-dim">{preview.status} · Show this code to the gate scanner.</p>
      </div>}
      {pdf.error && <div role="alert" className="text-sm"><p>{preview ? "Your ticket is ready to show, but its PDF could not be prepared." : "The ticket PDF could not be prepared."} {pdf.error.message}</p><Button variant="outline" className="mt-2" onClick={() => pdf.refetch()}><RefreshCw className="size-4" />Retry PDF</Button></div>}
      <p className="text-xs text-muted-foreground">Show this ticket at the entrance, on your phone or printed. The download is the same PDF attached to your email.</p>
    </section>
  );
}
