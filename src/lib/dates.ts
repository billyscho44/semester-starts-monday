export const TZ = "America/New_York";

export function todayIso(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const utc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function dayIndex(startIso: string, iso: string): number {
  return Math.round((utc(iso) - utc(startIso)) / 86400000);
}

export function addDays(iso: string, n: number): string {
  return new Date(utc(iso) + n * 86400000).toISOString().slice(0, 10);
}

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(utc(s));
}

/** Plan position for a date: week 1-4, day 1-7, or null outside the 28-day block. */
export function planPosition(startIso: string, iso: string): { week: number; day: number; idx: number } | null {
  const idx = dayIndex(startIso, iso);
  if (idx < 0 || idx >= 28) return null;
  return { week: Math.floor(idx / 7) + 1, day: (idx % 7) + 1, idx };
}

export function longLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  }).format(new Date(utc(iso)));
}

export function shortLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(utc(iso)));
}
