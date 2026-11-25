"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EventImage({
  images = [],
  name,
  className,
  thumbnail = false,
}: {
  images?: string[];
  name: string;
  className?: string;
  thumbnail?: boolean;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const source = images.find((url) => url && !failed.includes(url));
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30",
        thumbnail && "rounded-md",
        className,
      )}
    >
      {source ? (
        <img
          src={source}
          alt={`${name} artwork`}
          className={cn(
            "h-full w-full",
            thumbnail ? "object-cover" : "object-contain",
          )}
          onError={() => setFailed((old) => [...old, source])}
        />
      ) : (
        <span className="flex flex-col items-center gap-1 p-2 text-center text-xs text-muted-foreground">
          <ImageIcon className="size-5" />
          <span className="sr-only">No artwork available for {name}</span>
        </span>
      )}
    </div>
  );
}
