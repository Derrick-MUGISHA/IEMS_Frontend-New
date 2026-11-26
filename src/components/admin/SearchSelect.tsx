"use client";

import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from "@ui-sdk/react/combobox";
import { EventImage } from "./EventImage";
import { cn } from "@/lib/utils";

export type Choice = { value: string; label: string; description?: string; images?: string[] };
export function SearchSelect({ options, value, onChange, label, placeholder, className, ...props }: {
  options: Choice[]; value: string; onChange: (value: string) => void; label: string; placeholder?: string; className?: string;
} & Pick<ComponentProps<typeof ComboboxInput>, "id" | "disabled" | "onBlur" | "aria-describedby" | "aria-invalid" | "ref">) {
  return <Combobox items={options} value={value || null} onValueChange={(next) => onChange(next ?? "")} disabled={props.disabled}
    filter={(item, query) => `${item.label} ${options.find((option) => option.value === item.value)?.description ?? ""}`.toLowerCase().includes(query.toLowerCase())}>
    <div className={cn("admin-choice flex h-11 min-w-44 items-center rounded-md border border-input bg-card", className)}>
      <ComboboxInput {...props} aria-label={label} placeholder={placeholder ?? label} className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm outline-none" />
      <ComboboxTrigger aria-label={`Show ${label.toLowerCase()}`} className="h-full shrink-0 border-0 bg-transparent px-2"><ChevronDown className="size-4" /></ComboboxTrigger>
    </div>
    <ComboboxContent align="start" sideOffset={6} className="admin-sdk-popup w-[max(var(--anchor-width),280px)] max-w-[calc(100vw-2rem)]">
      <ComboboxEmpty>No matching options.</ComboboxEmpty><ComboboxList>
        {options.map((option) => <ComboboxItem key={option.value} value={option.value} label={option.label} className="flex items-center gap-3 rounded px-3 py-2.5">
          {option.images && <EventImage thumbnail images={option.images} name={option.label} className="size-[50px]" />}
          <span className="min-w-0"><span className="block text-sm font-medium">{option.label}</span>{option.description && <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>}</span>
        </ComboboxItem>)}
      </ComboboxList>
    </ComboboxContent>
  </Combobox>;
}
