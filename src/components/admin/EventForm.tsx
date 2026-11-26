"use client";

import { useRef, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventFormSchema, type EventFormInput, type EventFormValues } from "@/schemas/admin";
import { EVENT_CATEGORIES, EVENT_TYPES, EVENT_STATUSES } from "@/types/admin";
import { CalendarDays, Clock, Link2, Plus, Trash2, Check, ArrowLeft, ArrowRight, MapPin, Users, Globe, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatEventDateTime, kigaliInputToISO } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EventImage } from "./EventImage";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EventFormProps = {
  mode: "create" | "edit";
  defaultValues?: Partial<EventFormInput>;
  submitting?: boolean;
  onSubmit: (values: EventFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

const BASE: EventFormInput = {
  name: "",
  slug: "",
  category: "Mentorship",
  type: "WORKSHOP",
  startTime: "",
  endTime: "",
  gallery: [],
  organiser: "Igire Rwanda Organization",
  maxAttendees: 0,
  plusOneLimit: 0,
  details: "",
  rules: [],
  price: "Free",
  location: "",
  isPublished: false,
  status: "DRAFT",
};

/* consistent, evenly-rounded controls across the whole form (xl, never pills) */
const CONTROL = "rounded-md";

/* a titled frame that groups related fields, so the form reads as sections
   instead of one long column */
function Section({
  title,
  description,
  children,
  cols = 1,
  hidden = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  cols?: 1 | 2;
  hidden?: boolean;
}) {
  return (
    <section hidden={hidden} className="rounded-lg border border-border bg-card/40 p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="display text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className={cn("grid gap-5", cols === 2 && "sm:grid-cols-2 items-start")}>{children}</div>
    </section>
  );
}

/* Split the single datetime value into a distinct date picker and clock picker
   so each reads clearly — the date carries a calendar affordance, the time a
   clock. They stay backed by one `YYYY-MM-DDTHH:mm` string. */
function DateTimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [date = "", time = ""] = (value || "").split("T");
  const commit = (d: string, t: string) => {
    if (!d) return onChange("");
    onChange(`${d}T${t || "09:00"}`);
  };
  return (
    <div className="grid grid-cols-[1.5fr_1fr] gap-2">
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          aria-label="Date"
          className={cn(CONTROL, "pl-9 [color-scheme:dark]")}
          value={date}
          onChange={(e) => commit(e.target.value, time)}
        />
      </div>
      <div className="relative">
        <Clock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="time"
          aria-label="Time"
          className={cn(CONTROL, "pl-9 [color-scheme:dark]")}
          value={time}
          onChange={(e) => commit(date, e.target.value)}
        />
      </div>
    </div>
  );
}

export function EventForm({ mode, defaultValues, submitting, onSubmit, onCancel }: EventFormProps) {
  const form = useForm<EventFormInput, unknown, EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: { ...BASE, ...defaultValues },
  });

  const [step, setStep] = useState(0);
  const saving = useRef(false);
  const lastSlug = useRef(defaultValues?.slug ?? "");
  const values = useWatch({ control: form.control });
  const steps = ["Event overview", "Schedule & venue", "Artwork & review"];
  const stepFields: (keyof EventFormInput)[][] = [
    ["name", "slug", "category", "type", "details", "status"],
    ["startTime", "endTime", "location", "organiser", "maxAttendees", "plusOneLimit", "price"],
    ["gallery", "rules", "isPublished"],
  ];
  const next = async () => { if (await form.trigger(stepFields[step], { shouldFocus: true })) setStep((value) => Math.min(2, value + 1)); };
  const submit = form.handleSubmit(
    async (data) => {
      try { await onSubmit({ ...data, rules: data.rules.map((rule) => rule.trim()).filter(Boolean) }); }
      catch { /* Mutation errors are displayed by the page; retain the event draft. */ }
    },
    (errors) => {
      const key = Object.keys(errors)[0] as keyof EventFormInput;
      const target = stepFields.findIndex((fields) => fields.includes(key));
      if (target >= 0) setStep(target);
      setTimeout(() => form.setFocus(key), 0);
    },
  );
  const save = async () => {
    if (saving.current || submitting) return;
    saving.current = true;
    try { await submit(); }
    finally { saving.current = false; }
  };
  const previewDate = values.startTime && Number.isFinite(Date.parse(values.startTime))
    ? formatEventDateTime(kigaliInputToISO(values.startTime)) : "Choose the date and time";

  return (
    <Form {...form}>
      <form onSubmit={(event) => event.preventDefault()} className="space-y-6">
        <nav aria-label="Event form steps" className="grid gap-2 sm:grid-cols-3">
          {steps.map((title, index) => <button key={title} type="button" aria-current={step === index ? "step" : undefined}
            onClick={() => { if (index < step) setStep(index); else if (index > step) void next(); }}
            className={cn("flex items-center gap-3 rounded-md border p-4 text-left text-sm transition-colors", step === index ? "border-primary/60 bg-primary/10" : "border-border bg-card hover:bg-muted/40")}>
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", index <= step ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>{index < step ? <Check className="size-4" /> : index + 1}</span><span className="font-medium">{title}</span>
          </button>)}
        </nav>
        {Object.keys(form.formState.errors).length > 0 && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-300">Please correct the highlighted fields before continuing.</p>}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="min-w-0 space-y-6">
        <Section hidden={step !== 0} title="Event information" description="Tell attendees what you are organising." cols={2}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Event name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Women in Tech Night" className={CONTROL} {...field} onChange={(event) => {
                    field.onChange(event);
                    if (mode === "create" && (!form.getValues("slug") || form.getValues("slug") === lastSlug.current)) {
                      const slug = event.target.value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                      lastSlug.current = slug;
                      form.setValue("slug", slug, { shouldValidate: false });
                    }
                  }} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {mode === "create" && (
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Event link</FormLabel>
                  <FormControl>
                    <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
                      <span className="flex items-center gap-1.5 border-r border-input bg-muted/40 px-3 text-sm text-muted-foreground select-none">
                        <Link2 className="size-3.5" />
                        /events/
                      </span>
                      <input
                        {...field}
                        placeholder="women-in-tech-night"
                        className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Generated from the event name. You can adjust it before saving; it stays fixed afterwards.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className={cn("w-full", CONTROL)}>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EVENT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className={cn("w-full", CONTROL)}>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {(
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className={cn("w-full", CONTROL)}>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EVENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </Section>

        <Section hidden={step !== 1} title="Date & time" description="When the doors open and, optionally, close. Times are Kigali time (GMT+2)." cols={2}>
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Starts</FormLabel>
                <FormControl>
                  <DateTimeField value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ends (optional)</FormLabel>
                <FormControl>
                  <DateTimeField value={field.value ?? ""} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section hidden={step !== 1} title="Location & capacity" description="Where it happens and how many can attend." cols={2}>
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="Main Hall, Kigali" className={CONTROL} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="organiser"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organiser</FormLabel>
                <FormControl>
                  <Input className={CONTROL} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxAttendees"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    className={CONTROL}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={String(field.value ?? "")}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormDescription>0 = uncapped.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="plusOneLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plus-one limit</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Unlimited"
                    className={CONTROL}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value ? String(field.value) : ""}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  How many participants may bring a plus-one, first come first served.
                  Leave empty for unlimited.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <Input placeholder="Free" className={CONTROL} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section hidden={step !== 0} title="About this event" description="Describe the event — use bold, italics and lists to keep it readable.">
          <FormField
            control={form.control}
            name="details"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RichTextEditor
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="What the session is about…"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <Section
          hidden={step !== 2}
          title="Attendance information"
          description="Optional instructions shown to attendees before registration."
        >
          <FormField
            control={form.control}
            name="rules"
            render={({ field }) => {
              const rules: string[] = field.value ?? [];
              const setRule = (i: number, v: string) =>
                field.onChange(rules.map((r, idx) => (idx === i ? v : r)));
              const addRule = () => field.onChange([...rules, ""]);
              const removeRule = (i: number) => field.onChange(rules.filter((_, idx) => idx !== i));
              return (
                <FormItem>
                  <div className="space-y-2">
                    {rules.map((rule, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-5 shrink-0 text-center text-sm text-muted-foreground">
                          {i + 1}.
                        </span>
                        <Input
                          value={rule}
                          placeholder="e.g. Bring a valid ID"
                          className={CONTROL}
                          onChange={(e) => setRule(i, e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove rule"
                          onClick={() => removeRule(i)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addRule}>
                      <Plus className="size-4" /> Add rule
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </Section>

        <Section
          hidden={step !== 2}
          title="Event artwork"
          description="The first image is the event poster and ticket background. Keep the full original image. PNG or JPG, up to 8 MB each."
        >
          <FormField
            control={form.control}
            name="gallery"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <ImageUploader value={field.value ?? []} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </Section>

        <FormField
          control={form.control}
          name="isPublished"
          render={({ field }) => (
            <FormItem className={cn("flex items-center justify-between rounded-lg border border-border bg-card/40 p-5 sm:p-6", step !== 2 && "hidden")}>
              <div>
                <FormLabel>Published</FormLabel>
                <FormDescription>Show this event on the public calendar.</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/95 p-4 backdrop-blur">
          <span className="text-xs text-muted-foreground">Step {step + 1} of 3</span><div className="flex flex-wrap gap-2">
            {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
            {step > 0 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)}><ArrowLeft className="size-4" />Back</Button>}
            {step < 2 ? <Button key="continue" type="button" onClick={() => void next()}>Continue<ArrowRight className="size-4" /></Button> : <Button key="save" type="button" onClick={() => void save()} disabled={submitting || form.formState.isSubmitting}>{submitting || form.formState.isSubmitting ? "Saving…" : mode === "create" ? "Create event" : "Save changes"}</Button>}
          </div>
        </div>
        </div><aside className="space-y-4 rounded-lg border border-border bg-card p-5 xl:sticky xl:top-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event preview</p>
          <EventImage images={values.gallery as string[] | undefined} name={values.name || "New event"} className="aspect-[3/2] w-full" />
          <h2 className="break-words text-xl font-semibold">{values.name || "Your event name"}</h2>
          <p className="text-xs text-muted-foreground">{values.category} · {values.type?.toLowerCase()}</p>
          <div className="space-y-3 border-y border-border py-4 text-sm">
            <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{previewDate}<span className="sr-only">Kigali time</span></p>
            <p className="flex items-start gap-2"><MapPin className="size-4 shrink-0 text-muted-foreground" />{values.location || "Add a venue"}</p>
            <p className="flex items-center gap-2"><Users className="size-4 text-muted-foreground" />{Number(values.maxAttendees) > 0 ? `${values.maxAttendees} places` : "Unlimited capacity"}</p>
            <p className="flex items-center gap-2"><UserPlus className="size-4 text-muted-foreground" />{Number(values.plusOneLimit) > 0 ? `${values.plusOneLimit} plus-one places` : "Unlimited plus-ones"}</p>
            <p className="flex items-center gap-2"><Globe className="size-4 text-muted-foreground" />{values.isPublished ? "Visible on public calendar" : "Not listed publicly"}</p>
          </div>
          <p className="text-xs text-muted-foreground">Registration: <b className="capitalize text-foreground">{values.status?.toLowerCase()}</b>. Times use Africa/Kigali (GMT+2).</p>
          <p className="text-xs text-muted-foreground">The artwork will also appear on the single PDF ticket issued to every attendee.</p>
        </aside></div>
      </form>
    </Form>
  );
}
