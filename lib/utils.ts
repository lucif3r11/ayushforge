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
