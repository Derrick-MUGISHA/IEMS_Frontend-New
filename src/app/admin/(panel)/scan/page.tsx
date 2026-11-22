"use client";

import { useAdminAuth } from "@/context/AuthContext";
import Scanner from "@/components/portal/Scanner";
import { PageHeader } from "@/components/admin/PageHeader";

export default function AdminScanPage() {
  const { user } = useAdminAuth();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="Gate check-in" description="Scan tickets, confirm entry and follow activity across all gates." />
      <Scanner role="admin" profile={{ name: user?.name, email: user?.email }} />
    </div>
  );
}
