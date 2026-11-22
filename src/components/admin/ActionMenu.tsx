"use client";
import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, Settings2 } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { ConfirmDialog } from "./ConfirmDialog";
export type AdminAction = { label: string; icon: ReactNode; run: () => void | Promise<unknown>; disabled?: boolean; confirm?: { title: string; description: string; destructive?: boolean } };
export function ActionMenu({ actions, label = "Actions" }: { actions: AdminAction[]; label?: string }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState<AdminAction | null>(null);
  return <><Menu onAction={(value) => { const action = actions[Number(value)]; if (action.confirm) setPending(action); else return action.run(); }}>
    <MenuTrigger ref={trigger} className="admin-action-trigger"><Settings2 className="size-4" />{label}<ChevronDown className="size-3.5" /></MenuTrigger>
    <MenuContent align="end" sideOffset={6} className="admin-sdk-popup min-w-56">
      {actions.map((action, index) => <MenuItem key={action.label} value={String(index)} disabled={action.disabled} className={action.confirm?.destructive ? "text-red-400" : ""}>{action.icon}{action.label}</MenuItem>)}
    </MenuContent>
  </Menu><ConfirmDialog onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }} trigger={null} open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }} title={pending?.confirm?.title ?? "Confirm action"} description={pending?.confirm?.description} destructive={pending?.confirm?.destructive} confirmLabel={pending?.label} onConfirm={async () => { await pending?.run(); }} /></>;
}
