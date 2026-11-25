"use client";

import { AdminFormSkeleton } from "@/components/admin/PageSkeletons";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGuest, useUpdateGuest } from "@/hooks/admin/guests";
import { guestEditSchema, type GuestEditValues } from "@/schemas/admin";
import { GUEST_TYPES } from "@/types/admin";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, ErrorState } from "@/components/admin/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
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

export default function EditGuestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isPending, error, refetch } = useGuest(id);
  const update = useUpdateGuest();
  const form = useForm<GuestEditValues>({
    resolver: zodResolver(guestEditSchema),
    defaultValues: { name: "", email: "", guestType: "GENERAL" },
  });

  const g = data?.guest;
  useEffect(() => {
    if (g) form.reset({ name: g.name, email: g.email, guestType: g.guestType });
  }, [g, form]);

  if (isPending) return <AdminFormSkeleton kind="guest" fields={3} />;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!g) return <EmptyState title="Guest not found" />;

  async function onSubmit(v: GuestEditValues) {
    try {
      await update.mutateAsync({ id, body: v });
      router.push(`/admin/guests/${id}`);
    } catch { /* The mutation displays the API error; preserve the form. */ }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Edit guest"
        description="Update contact information and the guest type shown on their pass."
        crumbs={[
          { label: "Guests", href: "/admin/guests" },
          { label: g.name, href: `/admin/guests/${id}` },
          { label: "Edit" },
        ]}
      />
      <Card className="shadow-none">
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <fieldset disabled={update.isPending}>
              <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <FormField
                control={form.control}
                name="guestType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guest type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GUEST_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
              </fieldset>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/admin/guests/${id}`)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
