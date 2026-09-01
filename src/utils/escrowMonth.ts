const MONTH_ALIASES: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

export function parseEscrowMonth(value: unknown): number | undefined | null {
  if (value == null || String(value).trim() === '') return undefined;
  const raw = String(value).trim().toLowerCase();
  if (MONTH_ALIASES[raw] != null) return MONTH_ALIASES[raw];
  const n = Number.parseInt(raw, 10);
  if (Number.isInteger(n) && n >= 1 && n <= 12 && String(n) === String(parseInt(raw, 10))) {
    return n;
  }
  return null;
}

export function parseEscrowYear(value: unknown, fallbackYear: number): number | null {
  if (value == null || String(value).trim() === '') return fallbackYear;
  const n = Number.parseInt(String(value).trim(), 10);
  if (Number.isInteger(n) && n >= 2000 && n <= 2100) return n;
  return null;
}

export function utcMonthRange(year: number, month: number): { startIso: string; endIso: string } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
