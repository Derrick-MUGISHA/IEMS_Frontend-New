"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { api, ApiError } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Button as SdkButton } from "@ui-sdk/react/button";

export function ImageUploader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function pick(files: FileList | null) {
    if (!files || files.length === 0 || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const selected = Array.from(files);
      setProgress({ done: 0, total: selected.length });
      const urls: (string | undefined)[] = Array(selected.length);
      const failures: string[] = [];
      let next = 0;
      const worker = async () => {
        while (next < selected.length) {
          const index = next++;
          const file = selected[index];
          try {
            const form = new FormData();
            form.append("image", file);
            const { url } = await api<{ url: string }>("/api/admin/uploads", {
              role: "admin",
              form,
            });
            urls[index] = url;
          } catch (err) { failures.push(`${file.name}: ${err instanceof Error ? err.message : "Upload failed"}`); }
          finally { setProgress((current) => ({ ...current, done: current.done + 1 })); }
        }
      };
      await Promise.all(Array.from({ length: Math.min(2, selected.length) }, worker));
      const uploaded = urls.filter((url): url is string => !!url);
      if (uploaded.length) onChange([...valueRef.current, ...uploaded]);
      if (failures.length) setError(`${failures.length} image(s) failed. ${failures.join(" ")}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      lock.current = false;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const remove = (url: string) => onChange(value.filter((u) => u !== url));

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((url, i) => (
            <div
              key={url}
              className="group relative size-24 overflow-hidden rounded-xl border border-border"
            >
              <img src={url} alt="" className="size-full object-contain" />
              {i === 0 && (
                <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] font-semibold text-white">
                  Poster
                </span>
              )}
              <SdkButton
                type="button"
                onClick={() => remove(url)}
                aria-label="Remove image"
                disabled={busy}
                className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-3" />
              </SdkButton>
            </div>
          ))}
        </div>
      )}

      {/* the drop-zone: click or drag images straight in */}
      <SdkButton
        type="button"
        disabled={busy}
        aria-busy={busy}
        aria-label="Upload images"
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files);
        }}
        className={cn(
          "flex h-auto w-full cursor-pointer flex-col items-center justify-center gap-2 whitespace-normal rounded-xl! border border-dashed bg-transparent px-6 py-8 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          drag
            ? "border-primary bg-primary/5 text-primary"
            : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
          busy && "pointer-events-none opacity-60"
        )}
      >
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            drag ? "bg-primary/15" : "bg-muted"
          )}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : drag ? (
            <UploadCloud className="size-5" />
          ) : (
            <ImagePlus className="size-5" />
          )}
        </span>
        <span>
          <span className="block text-sm font-medium text-foreground">
            {busy ? `Uploading ${progress.done} of ${progress.total}…` : "Click to upload or drag & drop"}
          </span>
          <span className="block text-xs text-muted-foreground">
            The first image becomes the poster · PNG or JPG, up to 8MB each
          </span>
        </span>
      </SdkButton>

      <input
        ref={inputRef}
        type="file"
        disabled={busy}
        accept="image/*"
        multiple
        hidden
        onChange={(e) => pick(e.target.files)}
      />
      {busy && <p role="status" className="text-xs text-muted-foreground">{progress.done} of {progress.total} images processed. Large photos are optimised before transfer.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {value.length > 0 && (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange([])}>
          Clear all
        </Button>
      )}
    </div>
  );
}
