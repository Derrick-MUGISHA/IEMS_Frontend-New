"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/* A confirmation gate before destructive/irreversible actions. Wrap the
   trigger element; `onConfirm` may be async (shows a pending label). */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
  open: controlledOpen,
  onOpenChange,
  onCloseAutoFocus,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  open?: boolean; onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      /* the action surfaces its own failure (mutation onError → toast); swallow
         here so a rejected confirm doesn't escape `void run()` as an
         unhandledRejection. Keep the dialog open so the user can retry. */
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild data-slot="confirmation-trigger">{trigger}</AlertDialogTrigger>}
      <AlertDialogContent className="max-w-md rounded-lg" onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader className="items-center text-center sm:text-center">
          <span
            className={cn(
              "mb-1 flex size-12 items-center justify-center rounded-full",
              destructive ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary"
            )}
          >
            {destructive ? (
              <AlertTriangle className="size-6" />
            ) : (
              <HelpCircle className="size-6" />
            )}
          </span>
          <AlertDialogTitle className="text-lg">{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-center">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogCancel disabled={busy} className="rounded-md">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void run();
            }}
            disabled={busy}
            className={cn(
              "rounded-md",
              destructive && "bg-red-600 text-white hover:bg-red-700"
            )}
          >
            {busy ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
