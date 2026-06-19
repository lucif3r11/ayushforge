import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DetailedBlock } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BODYWEIGHT_KEYWORDS = [
  "bodyweight", " bw", "bw ", "calisthenics",
  "pull-up", "pull up", "pullup", "chin-up", "chin up", "chinup",
  "dip", "push-up", "push up", "pushup",
  "plank", "hollow", "l-sit", "lsit", "leg raise", "hanging",
  "burpee", "inverted row", "muscle-up", "muscle up",
  "sit-up", "sit up", "situp", "crunch", "v-up",
  "mountain climber", "dead bug", "bird dog",
  "mobility", "warm-up", "warmup", "prehab", "nordic",
  "stretch", "yoga", "foam roll", "activation", "breathing",
  "meditation", "hip circle", "band pull",
];

const BW_TEXT_RE = /\b(bodyweight|bw)\b/i;

export function isBodyweightExercise(name: string, category?: string): boolean {
  if (category === "mobility" || category === "cardio") return true;
  const lower = name.toLowerCase();
  return BODYWEIGHT_KEYWORDS.some((kw) => lower.includes(kw));
}

/** True when any load/notes/progression text explicitly mentions bodyweight or BW. */
export function textSuggestsBodyweight(...parts: (string | undefined | null)[]): boolean {
  return parts.some((p) => !!p && BW_TEXT_RE.test(p));
}

/** Collects load-related hint strings from detailed-block exercises matching `name`. */
export function detailedBlockLoadHints(name: string, blocks: DetailedBlock[]): string[] {
  const hints: string[] = [];
  const target = name.trim().toLowerCase();
  if (!target) return hints;
  for (const block of blocks) {
    for (const day of block.days) {
      for (const section of day.sections) {
        const groups = [...section.groups, ...(section.supersetGroups ?? [])];
        for (const group of groups) {
          for (const ex of group.exercises) {
            if (ex.name.trim().toLowerCase() === target) {
              if (ex.load) hints.push(ex.load);
              if (ex.loadProgression) hints.push(ex.loadProgression);
              if (ex.notes) hints.push(ex.notes);
            }
          }
        }
      }
    }
  }
  return hints;
}

/** Default weight string for a new set — "BW" for bodyweight moves, else "" or a numeric hint. */
export function defaultExerciseWeight(
  name: string,
  category?: string,
  ...loadHints: (string | undefined | null)[]
): string {
  if (isBodyweightExercise(name, category) || textSuggestsBodyweight(...loadHints)) {
    return "BW";
  }
  for (const hint of loadHints) {
    const trimmed = (hint ?? "").trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  }
  return "";
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
