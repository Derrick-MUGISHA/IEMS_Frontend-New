import { z } from "zod";
import { STACKS, GENDERS } from "@/types/admin";

export const MAX_IMPORT_ROWS = 1000;
export const importParticipantSchema = z.object({
  name: z.string().trim().min(2, "Full name needs at least 2 characters").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  phone: z.string().trim().max(40).refine((value) => !value || value.length >= 6, "Phone needs at least 6 characters").optional(),
  stack: z.enum(STACKS).optional(), gender: z.enum(GENDERS).optional(),
});
export type ImportParticipant = z.infer<typeof importParticipantSchema>;
export type ImportRow = { row: number; values: ImportParticipant; errors: string[] };

/** CSV/TSV parsing with quoted commas, escaped quotes, multiline cells and BOM. */
export function parseParticipantImport(input: string): ImportRow[] {
  if (input.length > 1_000_000) throw new Error("Use a file or paste smaller than 1 MB.");
  const source = input.replace(/^\uFEFF/, "");
  if (!source.trim()) return [];
  const firstLine = source.split(/\r?\n/)[0];
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const records: string[][] = [];
  let record: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || !cell.trim()) quoted = !quoted;
      else cell += char;
    } else if (char === delimiter && !quoted) { record.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      record.push(cell.trim()); if (record.some(Boolean)) records.push(record); record = []; cell = "";
      if (char === "\r" && source[i + 1] === "\n") i++;
    } else cell += char;
  }
  if (quoted) throw new Error("A quoted cell is not closed. Check the quotation marks in your data.");
  record.push(cell.trim()); if (record.some(Boolean)) records.push(record);
  const aliases: Record<string, keyof ImportParticipant> = { name: "name", fullname: "name", participantname: "name", email: "email", emailaddress: "email", phone: "phone", phonenumber: "phone", mobile: "phone", telephone: "phone", stack: "stack", track: "stack", gender: "gender", sex: "gender" };
  const headers = records[0]?.map((value) => aliases[value.toLowerCase().replace(/[^a-z]/g, "")]);
  const hasHeader = headers?.includes("email") && headers.includes("name");
  const columns = hasHeader ? headers : ["name", "email", "phone", "stack", "gender"] as const;
  const body = hasHeader ? records.slice(1) : records;
  if (body.length > MAX_IMPORT_ROWS) throw new Error(`Import up to ${MAX_IMPORT_ROWS.toLocaleString()} participants at a time. Split larger lists into batches.`);
  const seen = new Set<string>();
  return body.map((cells, index) => {
    const values: Record<string, string> = {};
    cells.forEach((value, column) => { const key = columns[column]; if (key) values[key] = value; });
    if (values.stack) values.stack = values.stack.toUpperCase().replace(/[\s_-]/g, ""); else delete values.stack;
    if (values.gender) {
      const gender = values.gender.toUpperCase().trim();
      values.gender = ({ F: "FEMALE", M: "MALE", WOMAN: "FEMALE", MAN: "MALE" } as Record<string, string>)[gender] ?? gender;
    } else delete values.gender;
    values.email = (values.email ?? "").toLowerCase().trim();
    values.name = values.name ?? "";
    const parsed = importParticipantSchema.safeParse(values);
    const errors = parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    if (seen.has(values.email)) errors.push("Duplicate email in this list");
    if (values.email) seen.add(values.email);
    return { row: index + (hasHeader ? 2 : 1), values: parsed.success ? parsed.data : values as ImportParticipant, errors };
  });
}
