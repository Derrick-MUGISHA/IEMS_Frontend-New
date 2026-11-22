"use client";

import { AdminFormSkeleton } from "@/components/admin/PageSkeletons";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole, Mail, Save, ScanLine, ShieldCheck, UserRound, X } from "lucide-react";
import { useScanner, useUpdateScanner } from "@/hooks/admin/scanners";
import { scannerEditSchema, type ScannerEditValues } from "@/schemas/admin";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, ErrorState } from "@/components/admin/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function EditScannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: scanner, isPending, error, refetch } = useScanner(id);
  const update = useUpdateScanner();
  const form = useForm<ScannerEditValues>({
    resolver: zodResolver(scannerEditSchema),
    defaultValues: { name: "", active: true, password: "" },
  });

  useEffect(() => {
    if (scanner) form.reset({ name: scanner.name, active: scanner.active, password: "" });
  }, [scanner, form]);

  if (isPending) return <AdminFormSkeleton kind="scanner" fields={3} />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!scanner) return <EmptyState title="Scanner not found" />;

  async function onSubmit(v: ScannerEditValues) {
    try {
      await update.mutateAsync({ id, body: { ...v, password: v.password || undefined } });
      router.push("/admin/scanners");
    } catch { /* The mutation shows the API error; preserve the form for retry. */ }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Edit scanner"
        description="Manage the scanner account name, password and sign-in access."
        crumbs={[{ label: "Scanners", href: "/admin/scanners" }, { label: scanner.name }, { label: "Edit" }]}
      />
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ScanLine aria-hidden="true" className="size-5" />Scanner account</CardTitle>
          <CardDescription className="flex items-center gap-2 break-all"><Mail aria-hidden="true" className="size-4 shrink-0" />{scanner.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <fieldset disabled={update.isPending} className="space-y-5">
              <div className="grid items-start gap-5 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel><UserRound aria-hidden="true" className="size-4" />Name</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel><LockKeyhole aria-hidden="true" className="size-4" />New password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" placeholder="Leave blank to keep current password" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormDescription>Use at least 8 characters when resetting the password.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><ShieldCheck aria-hidden="true" className="size-5" /></span>
                      <div><FormLabel>Active</FormLabel><FormDescription>Allow this scanner to sign in and check tickets. Disabled scanners can&apos;t sign in.</FormDescription></div>
                    </div>
                    <FormControl>
                      <Switch className="shrink-0 cursor-pointer" checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              </fieldset>
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
                <Button type="button" variant="outline" onClick={() => router.push("/admin/scanners")}>
                  <X aria-hidden="true" className="size-4" />Cancel
                </Button>
                <Button type="submit" disabled={update.isPending}>
                  <Save aria-hidden="true" className="size-4" />{update.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
