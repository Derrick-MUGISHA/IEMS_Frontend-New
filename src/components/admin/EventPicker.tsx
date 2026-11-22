"use client";
import type { ComponentProps } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEvents } from "@/hooks/admin/events";
import { EventImage } from "./EventImage";
import { cn } from "@/lib/utils";

export function EventPicker({
  value,
  onValueChange,
  includeAll,
  placeholder,
  className,
  ...props
}: {
  value?: string;
  onValueChange: (value: string) => void;
  includeAll?: boolean;
  placeholder?: string;
} & Pick<
  ComponentProps<typeof SelectTrigger>,
  | "className"
  | "disabled"
  | "id"
  | "onBlur"
  | "aria-invalid"
  | "aria-describedby"
  | "ref"
>) {
  const { data = [], isPending, error } = useEvents();
  const selected = value === "all" ? "All events" : data.find((event) => event.id === value)?.name;
  return (
    <Select
      value={value || ""}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      disabled={props.disabled}

    >
      <SelectTrigger
        {...props}
        aria-label="Event"
        className={cn(
          "admin-action-trigger event-picker-control h-11 min-w-44 justify-between",
          className,
        )}
      >
        <SelectValue placeholder={isPending ? "Loading events…" : error ? "Events unavailable" : placeholder ?? "Choose an event"}>{selected}</SelectValue>
      </SelectTrigger>
      <SelectContent
        align="start"
        position="popper"
        sideOffset={6}
        className="event-picker-popup w-[var(--radix-select-trigger-width)] min-w-72 max-w-[min(560px,calc(100vw-2rem))]"
      >
        {includeAll && (
          <SelectItem
            value="all"
            textValue="All events"
            className={cn(
              "table-page-size min-w-20 justify-between gap-2 py-2 pl-3 pr-8",
            )}
          >
            All events
          </SelectItem>
        )}
        {data.map((event) => (
          <SelectItem
            key={event.id}
            value={event.id}
            textValue={event.name}
            className="flex items-center gap-3"
          >
            <EventImage
              thumbnail
              images={event.gallery}
              name={event.name}
              className="size-[30px]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{event.name}</span>
              <span className="mt-0.5 block text-xs text-neutral-400">
                {event.location || "Venue pending"} ·{" "}
                {event.status.toLowerCase()}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
