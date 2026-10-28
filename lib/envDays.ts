/**
 * A whole number of days from the environment. An unset or EMPTY variable gives the fallback: Number("") is 0, and 0 days of
 * retention would make the daily run delete everything at once, so an empty value must never be read as a number.
 */
export function envDays(raw: string | undefined, fallback: number, min = 0): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : fallback;
}
