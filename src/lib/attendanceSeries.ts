import { eventDayISO, EVENT_TZ } from "./time";
export type AttendancePoint = { label: string; count: number };
/** Date keys and chart labels agree with the server's Kigali aggregation. */
export function attendanceSeries(daily: { day: string; count: number }[], hourly: { hour: string; count: number }[], range: string, now = new Date()): AttendancePoint[] {
  if (range === "all") return [...daily].sort((a,b) => a.day.localeCompare(b.day)).map((point) => ({ label: new Date(`${point.day}T12:00:00+02:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: EVENT_TZ }), count: point.count }));
  const points: AttendancePoint[] = [];
  const days = range === "7d" ? 7 : 30;
  const map = new Map((range === "24h" ? hourly.map((point) => [point.hour, point.count] as const) : daily.map((point) => [point.day, point.count] as const)));
  for (let offset = (range === "24h" ? 24 : days) - 1; offset >= 0; offset--) {
    const date = new Date(now.getTime() - offset * (range === "24h" ? 3_600_000 : 86_400_000));
    if (range === "24h") {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: EVENT_TZ, hour: "2-digit", hourCycle: "h23" }).format(date);
      points.push({ label: date.toLocaleTimeString("en-US", { hour: "numeric", timeZone: EVENT_TZ }), count: map.get(`${eventDayISO(date)}T${parts}:00`) ?? 0 });
    } else points.push({ label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: EVENT_TZ }), count: map.get(eventDayISO(date)) ?? 0 });
  }
  return points;
}
