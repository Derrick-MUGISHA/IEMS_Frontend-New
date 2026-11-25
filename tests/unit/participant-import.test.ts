import { describe, expect, it } from "vitest";
import { parseParticipantImport } from "@/lib/participantImport";
import { attendanceSeries } from "@/lib/attendanceSeries";

describe("participant import parsing", () => {
  it("accepts 150 pasted spreadsheet rows and preserves phone zeroes", () => {
    const rows = parseParticipantImport("Full Name\tEmail Address\tPhone\n" + Array.from({ length: 150 }, (_, i) => `Person ${i}\tperson${i}@example.com\t0788000000`).join("\n"));
    expect(rows).toHaveLength(150);
    expect(rows.every((row) => !row.errors.length)).toBe(true);
    expect(rows[0].values.phone).toBe("0788000000");
  });
  it("handles BOM, quoted commas, multiline names and escaped quotes", () => {
    const rows = parseParticipantImport('\uFEFFname,email\r\n"Uwase, ""Aline""\nMarie",ALINE@example.com\r\n');
    expect(rows[0].values).toMatchObject({ name: 'Uwase, "Aline"\nMarie', email: "aline@example.com" });
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].row).toBe(2);
  });
  it("flags invalid addresses and case insensitive duplicates", () => {
    const rows = parseParticipantImport("name,email\nAline,ALINE@example.com\nMarie,aline@example.com\nJohn,invalid");
    expect(rows[1].errors).toContain("Duplicate email in this list");
    expect(rows[2].errors.join()).toContain("valid email");
  });
  it("normalizes optional enum values", () => {
    const [row] = parseParticipantImport("Aline,aline@example.com,0788000000,front-end,f");
    expect(row.values).toMatchObject({ stack: "FRONTEND", gender: "FEMALE" });
    expect(row.errors).toEqual([]);
  });
  it("rejects oversized lists and unclosed quoted fields", () => {
    expect(() => parseParticipantImport('"Aline,aline@example.com')).toThrow("not closed");
    expect(() => parseParticipantImport(Array.from({ length: 1001 }, (_, i) => `Person ${i},p${i}@example.com`).join("\n"))).toThrow("1,000");
    expect(() => parseParticipantImport("a".repeat(1_000_001))).toThrow("1 MB");
  });
});

describe("attendance chart dates", () => {
  const now = new Date("2026-11-15T22:30:00Z");
  it("uses Kigali's next day and zero fills missing dates", () => {
    const points = attendanceSeries([{ day: "2026-11-16", count: 4 }], [], "7d", now);
    expect(points).toHaveLength(7);
    expect(points.at(-1)).toEqual({ label: "Nov 16", count: 4 });
    expect(points.slice(0, -1).every((p) => p.count === 0)).toBe(true);
  });
  it("matches the server hourly keys across local midnight", () => {
    const points = attendanceSeries([], [{ hour: "2026-11-16T00:00", count: 3 }], "24h", now);
    expect(points).toHaveLength(24);
    expect(points.at(-1)?.count).toBe(3);
    expect(points.reduce((sum, p) => sum + p.count, 0)).toBe(3);
  });
  it("keeps older event history in chronological order", () => {
    const points = attendanceSeries([{ day: "2026-11-16", count: 5 }, { day: "2025-01-01", count: 2 }], [], "all", now);
    expect(points.map((p) => p.count)).toEqual([2, 5]);
  });
});
