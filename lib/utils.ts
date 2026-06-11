import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BODYWEIGHT_KEYWORDS = [
  "bodyweight", " bw ", "mobility", "warm-up", "warmup", "prehab",
  "nordic", "plank", "dead bug", "stretch", "yoga", "foam roll",
  "activation", "breathing", "meditation", "hip circle", "band pull",
];

export function isBodyweightExercise(name: string, category?: string): boolean {
  if (category === "mobility") return true;
  const lower = name.toLowerCase();
  return BODYWEIGHT_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Alphanumeric weight helpers ──────────────────────────────────────────────
// SetLog.weight is a free-form string (e.g. "80", "BW", "BW + 10kg", "Assisted")
// so it can capture bodyweight/assisted/banded loads alongside plain numbers.
// These helpers bridge that string to the numeric values used in calculations
// and to the legacy `number` values that may still exist in old localStorage data.

/** Converts a persisted weight value (new string or legacy number) into an
 *  editable input string. */
export function weightToInputString(weight: string | number | undefined | null): string {
  if (typeof weight === "number") return weight > 0 ? String(weight) : "";
  return weight ?? "";
}

/** Parses a weight value into a kg number for calculations (volume, PRs, 1RM).
 *  Non-numeric values like "BW" or "Assisted" resolve to 0. */
export function parseWeightKg(weight: string | number | undefined | null): number {
  if (typeof weight === "number") return Number.isFinite(weight) ? weight : 0;
  const trimmed = (weight ?? "").trim();
  if (!trimmed) return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : 0;
}

/** Formats a weight value for read-only display, e.g. "80" -> "80 kg",
 *  "BW + 10kg" -> "BW + 10kg" (left as-is), "" / "0" -> "BW". */
export function formatWeightDisplay(
  weight: string | number | undefined | null,
  isBodyweight?: boolean
): string {
  const trimmed = weightToInputString(weight).trim();
  if (isBodyweight || !trimmed || trimmed === "0") return "BW";
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed} kg`;
  return trimmed;
}
