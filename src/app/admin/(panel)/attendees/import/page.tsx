"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, ClipboardPaste, Download, CheckCircle2, AlertCircle, Upload } from "lucide-react";
import { api } from "@/lib/client";
import { parseParticipantImport, MAX_IMPORT_ROWS, type ImportRow } from "@/lib/participantImport";
import { downloadCsv } from "@/lib/tableExport";
import { useSendParticipantInvitations } from "@/hooks/admin/participants";
import { adminKeys } from "@/hooks/admin/keys";
import { PageHeader } from "@/components/admin/PageHeader";
import { EventPicker } from "@/components/admin/EventPicker";
import { DataTable } from "@/components/admin/DataTable";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ImportParticipantsPage() {
  const [event, setEvent] = useState("");
  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const qc = useQueryClient();
  const invitations = useSendParticipantInvitations();
  const parsed = useMemo(() => { try { return { rows: parseParticipantImport(source), error: "" }; } catch (error) { return { rows: [] as ImportRow[], error: (error as Error).message }; } }, [source]);
  const invalid = parsed.rows.filter((row) => row.errors.length > 0).length;
  const importRows = useMutation({
    mutationFn: () => api<{ imported: number; skipped: number; received: number; participantIds: string[] }>("/api/admin/attendees/import", { role: "admin", body: { eventId: event, participants: parsed.rows.map((row) => row.values) } }),
    onSuccess: async (result) => {
      qc.invalidateQueries({ queryKey: adminKeys.participantsAll });
      qc.invalidateQueries({ queryKey: adminKeys.dashboard });
      qc.invalidateQueries({ queryKey: adminKeys.eventStats });
      if (result.participantIds.length) await invitations.mutateAsync(result.participantIds);
    },
  });
  const changeSource = (value: string) => { setSource(value); importRows.reset(); invitations.reset(); setFileError(""); };
  return <div className="space-y-6">
    <PageHeader title="Import participants" description={`Add 100+ people together. Preview up to ${MAX_IMPORT_ROWS.toLocaleString()} rows before importing.`} crumbs={[{ label: "Participants", href: "/admin/attendees" }, { label: "Import" }]}
      actions={<Button variant="outline" onClick={() => downloadCsv("participant-template.csv", ["name", "email", "phone", "stack", "gender"], [["Aline Uwase", "aline@example.com", "+250788000000", "FRONTEND", "FEMALE"]])}><Download />CSV template</Button>} />
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <Card><CardHeader><CardTitle className="text-base">1. Choose the event</CardTitle><CardDescription>Every person in this import will be registered for this event.</CardDescription></CardHeader><CardContent><EventPicker disabled={importRows.isPending} value={event} onValueChange={(id) => { setEvent(id); importRows.reset(); invitations.reset(); }} className="w-full" /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">2. Add your list</CardTitle><CardDescription>CSV files and rows copied from Excel or Google Sheets are supported.</CardDescription></CardHeader><CardContent>
          <Tabs defaultValue="upload"><TabsList className="mb-4"><TabsTrigger value="upload"><FileUp className="size-4" />Upload CSV</TabsTrigger><TabsTrigger value="paste"><ClipboardPaste className="size-4" />Paste rows</TabsTrigger></TabsList>
            <TabsContent value="upload"><label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center transition-colors hover:border-primary/60">
              <Upload className="size-8 text-muted-foreground" /><span className="font-semibold">Choose a CSV or TSV file</span><span className="text-xs text-muted-foreground">Up to 1 MB · {MAX_IMPORT_ROWS.toLocaleString()} participants per import</span>
              <input type="file" disabled={importRows.isPending} accept=".csv,.tsv,text/csv,text/tab-separated-values" className="block max-w-full text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-muted file:px-4 file:py-2 file:text-foreground" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                if (file.size > 1_000_000) { setFileError("Choose a file smaller than 1 MB."); return; }
                try { changeSource(await file.text()); setFileName(file.name); } catch { setFileError("This file could not be read. Try copying its rows into Paste rows."); }
              }} />
              {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
            </label></TabsContent>
            <TabsContent value="paste"><label className="mb-2 block text-sm font-medium" htmlFor="participant-rows">Participant rows</label><Textarea disabled={importRows.isPending} id="participant-rows" rows={9} className="font-mono text-xs" value={source} onChange={(e) => changeSource(e.target.value)} placeholder={'name,email,phone,stack,gender\nAline Uwase,aline@example.com,+250788000000,FRONTEND,FEMALE'} /><p className="mt-2 text-xs text-muted-foreground">Include column headers, or use this order: name, email, phone, stack, gender. Tabs and commas both work.</p></TabsContent>
          </Tabs>
          {(fileError || parsed.error) && <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-300">{fileError || parsed.error}</p>}
        </CardContent></Card>
      </div>
      <Card className="xl:sticky xl:top-6"><CardHeader><CardTitle className="text-base">Import checklist</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">
        <p><b>Required:</b> full name and email.</p><p className="text-muted-foreground">Phone, stack and gender are optional. Keep phone numbers as text to preserve their leading zero.</p>
        <p className="text-muted-foreground">Existing registrations are skipped. Their details, ticket and attendance remain unchanged.</p>
        <p className="text-muted-foreground">Each newly imported participant receives a verification invitation automatically. Tickets follow after they finish registration.</p>
        <div className="rounded-lg bg-muted/40 p-3"><p className="font-semibold">{parsed.rows.length} rows found</p><p className="mt-1 text-xs text-muted-foreground">{invalid ? `${invalid} rows need corrections` : "Ready rows will appear in the preview below"}</p></div>
      </CardContent></Card>
    </div>
    {parsed.rows.length > 0 && <Card><CardHeader><CardTitle className="text-base">3. Review and import</CardTitle><CardDescription>{invalid ? "Correct the highlighted rows using Paste rows before importing." : "Review names and email addresses. Nothing is saved until you click Import."}</CardDescription></CardHeader><CardContent>
      <DataTable data={parsed.rows} getRowId={(row) => String(row.row)} searchable={(row) => `${row.values.name} ${row.values.email} ${row.errors.join(" ")}`} searchPlaceholder="Search preview or errors…" columns={[
        { id: "row", header: "Row", cell: (row) => row.row }, { id: "name", header: "Name", cell: (row) => row.values.name || "Missing name" },
        { id: "email", header: "Email", cell: (row) => row.values.email || "Missing email" }, { id: "phone", header: "Phone", cell: (row) => row.values.phone || "—" },
        { id: "validation", header: "Validation", cell: (row) => row.errors.length ? <span className="text-xs text-red-300">{row.errors.join(" · ")}</span> : <span className="flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="size-3.5" />Ready</span> },
      ]} />
      <div className="mt-6 flex flex-wrap justify-end gap-3"><Button variant="outline" asChild><Link href="/admin/attendees">Cancel</Link></Button><Button disabled={!event || !!invalid || !!parsed.error || !!fileError || importRows.isPending || importRows.isSuccess} onClick={() => importRows.mutate()}><Upload />{invitations.isPending ? "Sending invitations…" : importRows.isPending ? "Importing…" : `Import ${parsed.rows.length} participants`}</Button></div>
    </CardContent></Card>}
    {invitations.isPending && <p role="status" className="text-sm text-muted-foreground">Sending invitation emails in batches. Keep this page open until delivery finishes.</p>}
    {invitations.data && <Card><CardContent className="space-y-3 pt-6"><p className="text-sm">Invitation emails: {invitations.data.sent.length} sent · {invitations.data.failed.length} failed in the latest attempt.</p>{invitations.data.failed.length > 0 && <div role="alert"><p className="mb-3 text-sm text-destructive">{invitations.data.failed[0].error}</p><Button type="button" variant="outline" disabled={invitations.isPending} onClick={() => invitations.mutate(invitations.data!.failed.map((item) => item.id))}>Retry failed invitations</Button></div>}</CardContent></Card>}
    {importRows.error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/40 p-4 text-sm text-red-300"><AlertCircle className="size-4" />{importRows.error.message}</div>}
    {importRows.data && <Card className="border-emerald-500/40"><CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6"><div><h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-5 text-emerald-400" />Import complete</h2><p className="mt-1 text-sm text-muted-foreground">{importRows.data.imported} added · {importRows.data.skipped} already registered or duplicate</p></div><Button asChild><Link href={`/admin/attendees?event=${event}`}>View participants</Link></Button></CardContent></Card>}
  </div>;
}
