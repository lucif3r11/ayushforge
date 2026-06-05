"use client";

import { useState, useCallback, useRef, DragEvent } from "react";
import {
  Upload,
  X,
  CheckCircle2,
  Utensils,
  Pill,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { NutritionPlan, NutritionSupplement, DietMeal, DayTypeKey } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Order matches the daily schedule: Breakfast → Pre-Workout → Post-Workout → Snacks/Standalones → Dinner
const DEFAULT_MEAL_LABELS = [
  "Breakfast",
  "Pre-Workout",
  "Post-Workout",
  "Snacks / Standalones",
  "Dinner",
];

// ─── Raw parsers ──────────────────────────────────────────────────────────────

function parseMeals(raw: unknown[]): DietMeal[] {
  return raw
    .map((m) => {
      const meal = m as Record<string, unknown>;
      return {
        label: String(meal.label ?? meal.name ?? "").trim(),
        content: String(meal.content ?? meal.description ?? meal.items ?? "").trim(),
      };
    })
    .filter((m) => m.label.length > 0);
}

function parseSupplements(raw: unknown[]): NutritionSupplement[] {
  return raw
    .map((s) => {
      const supp = s as Record<string, unknown>;
      return {
        id: supp.id ? String(supp.id) : uid(),
        name: String(supp.name ?? "").trim(),
        dose: String(supp.dose ?? supp.dosage ?? supp.amount ?? "").trim(),
        timing: String(supp.timing ?? supp.when ?? "").trim(),
        notes: supp.notes ? String(supp.notes) : undefined,
      };
    })
    .filter((s) => s.name.length > 0);
}

// Strict 1:1 mapping: JSON key → display slot
//   Breakfast           ← breakfast
//   Pre-Workout         ← preWorkout
//   Post-Workout        ← postWorkout
//   Snacks/Standalones  ← dinner  (smoothie / big meal content)
//   Dinner              ← snacks  (light meal + standalones content)
const MEAL_KEY_MAP: Record<string, string> = {
  // numbered shorthands (m1–m5 / meal1–meal5)
  m1: "Breakfast",   m2: "Pre-Workout",  m3: "Post-Workout",
  m4: "Snacks / Standalones", m5: "Dinner",
  meal1: "Breakfast", meal2: "Pre-Workout", meal3: "Post-Workout",
  meal4: "Snacks / Standalones", meal5: "Dinner",
  // named keys — swapped: dinner → Snacks slot, snacks → Dinner slot
  breakfast:    "Breakfast",
  preworkout:   "Pre-Workout",
  pre_workout:  "Pre-Workout",
  postworkout:  "Post-Workout",
  post_workout: "Post-Workout",
  dinner:       "Snacks / Standalones",  // smoothie content → Snacks section
  supper:       "Snacks / Standalones",
  snacks:       "Dinner",               // light meal content → Dinner section
  snack:        "Dinner",
  standalones:  "Snacks / Standalones",
  standalone:   "Snacks / Standalones",
};

/**
 * Parse the "inverted" day-type format:
 *   { breakfast: { veg: "...", egg: "..." }, postWorkout: { veg: "...", egg: "..." }, … }
 *
 * Transposes slot→dayType→content into dayType→[{label, content}].
 * Returns null if no recognised day-type keys are found.
 */
function parseMealsByDayType(
  mealsObj: Record<string, unknown>
): Partial<Record<DayTypeKey, DietMeal[]>> | null {
  const acc: Partial<Record<DayTypeKey, DietMeal[]>> = {};

  for (const [slotKey, slotVal] of Object.entries(mealsObj)) {
    if (!slotVal || typeof slotVal !== "object" || Array.isArray(slotVal)) continue;

    const slotNorm  = slotKey.toLowerCase().replace(/[-\s]/g, "");
    const slotLabel = MEAL_KEY_MAP[slotNorm] ?? MEAL_KEY_MAP[slotKey.toLowerCase()];
    if (!slotLabel) continue; // skip unrecognised slot keys

    for (const [dtKey, content] of Object.entries(slotVal as Record<string, unknown>)) {
      if (typeof content !== "string" || !content.trim()) continue;

      const dtNorm     = dtKey.toLowerCase().replace(/[-\s]/g, "");
      const dayTypeKey = DAY_TYPE_JSON_MAP[dtNorm] ?? DAY_TYPE_JSON_MAP[dtKey.toLowerCase()];
      if (!dayTypeKey) continue; // skip unrecognised day-type keys

      if (!acc[dayTypeKey]) acc[dayTypeKey] = [];
      acc[dayTypeKey]!.push({ label: slotLabel, content: content.trim() });
    }
  }

  // Sort each day type's meals by the canonical display order
  const order = DEFAULT_MEAL_LABELS.map((l) => l.toLowerCase());
  for (const meals of Object.values(acc)) {
    meals!.sort((a, b) => {
      const ia = order.indexOf(a.label.toLowerCase());
      const ib = order.indexOf(b.label.toLowerCase());
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  return Object.keys(acc).length > 0 ? acc : null;
}

/** Parse a plain object like { breakfast: "...", preWorkout: "..." } into DietMeal[]. */
function parseMealsObject(obj: Record<string, unknown>): DietMeal[] {
  const result: DietMeal[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val !== "string" || !val.trim()) continue;
    const normalized = key.toLowerCase().replace(/[-\s]/g, "");
    const label =
      MEAL_KEY_MAP[normalized] ??
      MEAL_KEY_MAP[key.toLowerCase()] ??
      key.charAt(0).toUpperCase() + key.slice(1); // fallback: capitalise key
    result.push({ label, content: val.trim() });
  }
  // Sort by DEFAULT_MEAL_LABELS order so the app's meal sections stay in the right order
  const order = DEFAULT_MEAL_LABELS.map((l) => l.toLowerCase());
  result.sort((a, b) => {
    const ia = order.indexOf(a.label.toLowerCase());
    const ib = order.indexOf(b.label.toLowerCase());
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return result;
}

// ─── Main parse function ──────────────────────────────────────────────────────

interface NutritionImportData {
  hasDiet: boolean;
  hasSupps: boolean;
  dietNotes: string;
  meals: DietMeal[];
  suppNotes: string;
  supplements: NutritionSupplement[];
  dayTypePlans?: Partial<Record<DayTypeKey, DietMeal[]>>;
}

// Maps JSON key variants → DayTypeKey
const DAY_TYPE_JSON_MAP: Record<string, DayTypeKey> = {
  vegtraining:  "vegTraining",
  veg_training: "vegTraining",
  veg:          "vegTraining",
  eggtraining:  "eggTraining",
  egg_training: "eggTraining",
  egg:          "eggTraining",
  wednesday:    "wednesday",
  wed:          "wednesday",
  refeed:       "wednesday",
  sunday:       "sunday",
  sun:          "sunday",
};

/** Read a value that may be a plain string or an object with a text field. */
function extractText(val: unknown, ...objectKeys: string[]): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    for (const key of objectKeys) {
      if (typeof obj[key] === "string") return obj[key] as string;
    }
  }
  return "";
}

/** Extract meals from:
 *  - an array of { label, content } objects
 *  - an object with a .meals array
 *  - a plain object with named meal keys (e.g. { breakfast: "...", preWorkout: "..." })
 */
function extractMeals(val: unknown): DietMeal[] {
  if (Array.isArray(val)) return parseMeals(val);
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (Array.isArray(obj.meals)) return parseMeals(obj.meals);
    // Plain named-key object — treat string values as meal content
    return parseMealsObject(obj);
  }
  return [];
}

/** Extract supplements from a value that may be an array or an object with a supplements array. */
function extractSupplements(val: unknown): NutritionSupplement[] {
  if (Array.isArray(val)) return parseSupplements(val);
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (Array.isArray(obj.supplements)) return parseSupplements(obj.supplements);
  }
  return [];
}

function parseNutritionFile(raw: unknown): NutritionImportData | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // ── Format 1: { type:"nutrition_only", dietSupps:{ dietPlan, suppsPlan } }
  // Also: { type:"nutrition_only", dietPlan, suppsPlan } at root
  if (obj.type === "nutrition_only") {
    const src = (obj.dietSupps && typeof obj.dietSupps === "object")
      ? obj.dietSupps as Record<string, unknown>
      : obj;
    return extractDietSuppsBlock(src);
  }

  // ── Format 2: root-level dietPlan / suppsPlan (string OR object) ─────────
  if (obj.dietPlan !== undefined || obj.suppsPlan !== undefined) {
    return extractDietSuppsBlock(obj);
  }

  // ── Format 3: Full Ironclad backup ───────────────────────────────────────
  if (obj.appName === "Ironclad" && obj.data && typeof obj.data === "object") {
    const d = obj.data as Record<string, unknown>;
    if (d.nutritionPlan && typeof d.nutritionPlan === "object") {
      return extractFromFlat(d.nutritionPlan as Record<string, unknown>);
    }
  }

  // ── Format 4: { type:"nutrition-plan", meals:[...], supplements:[...] } ──
  if (obj.type === "nutrition-plan") {
    return extractFromFlat(obj);
  }

  // ── Format 5: { nutritionPlan: { ... } } ─────────────────────────────────
  if (obj.nutritionPlan && typeof obj.nutritionPlan === "object") {
    return extractFromFlat(obj.nutritionPlan as Record<string, unknown>);
  }

  // ── Format 6: relaxed top-level keys ────────────────────────────────────
  if (obj.meals || obj.supplements || obj.dietNotes || obj.suppNotes) {
    return extractFromFlat(obj);
  }

  return null;
}

/**
 * Extract from a block that may be:
 *   - Day-type structured: { vegTraining: { breakfast, … }, eggTraining: { … }, … }
 *   - New flat format:     { meals: { breakfast, … }, supplements: […], dietPlan: "…" }
 *   - Old text-only:       { dietPlan: "long text", suppsPlan: "long text" }
 *   - Any combination of the above
 */
function extractDietSuppsBlock(src: Record<string, unknown>): NutritionImportData | null {
  const dayTypePlans: Partial<Record<DayTypeKey, DietMeal[]>> = {};

  // ── Format A: meals[slot][dayType] = content  (NEW — inverted nesting) ────
  // e.g. { meals: { breakfast: { veg: "...", egg: "..." }, postWorkout: { … } } }
  if (src.meals && typeof src.meals === "object" && !Array.isArray(src.meals)) {
    const mealsObj = src.meals as Record<string, unknown>;
    const hasNestedDayTypes = Object.values(mealsObj).some(
      (v) => v && typeof v === "object" && !Array.isArray(v)
    );
    if (hasNestedDayTypes) {
      const perDay = parseMealsByDayType(mealsObj);
      if (perDay) Object.assign(dayTypePlans, perDay);
    }
  }

  // ── Format B: { dayType: { slot: content } }  (OLD — day type at top) ────
  // e.g. { vegTraining: { breakfast: "...", postWorkout: "..." }, … }
  for (const [key, val] of Object.entries(src)) {
    const normalized = key.toLowerCase().replace(/[-\s]/g, "");
    const dayTypeKey =
      DAY_TYPE_JSON_MAP[normalized] ?? DAY_TYPE_JSON_MAP[key.toLowerCase()];
    if (dayTypeKey && val && typeof val === "object" && !Array.isArray(val)) {
      const parsed = parseMealsObject(val as Record<string, unknown>);
      if (parsed.length > 0 && !dayTypePlans[dayTypeKey]) {
        dayTypePlans[dayTypeKey] = parsed; // don't overwrite if already set by Format A
      }
    }
  }

  const hasDayTypes = Object.keys(dayTypePlans).length > 0;

  // ── Overview / notes text ─────────────────────────────────────────────────
  const dietNotes = extractText(src.dietPlan, "notes", "dietNotes", "overview", "text");
  const suppNotes = extractText(src.suppsPlan, "notes", "suppNotes", "overview", "text");

  // ── Flat meals (only relevant when no day-type structure is present) ───────
  const meals = hasDayTypes
    ? []
    : src.meals !== undefined
      ? extractMeals(src.meals)
      : extractMeals(src.dietPlan);

  // ── Supplements ───────────────────────────────────────────────────────────
  const supplements =
    src.supplements !== undefined
      ? extractSupplements(src.supplements)
      : extractSupplements(src.suppsPlan);

  const hasDiet = hasDayTypes || dietNotes.trim().length > 0 || meals.length > 0;
  const hasSupps = suppNotes.trim().length > 0 || supplements.length > 0;
  if (!hasDiet && !hasSupps) return null;

  return {
    hasDiet,
    hasSupps,
    dietNotes,
    meals,
    suppNotes,
    supplements,
    dayTypePlans: hasDayTypes ? dayTypePlans : undefined,
  };
}

function extractFromFlat(plan: Record<string, unknown>): NutritionImportData | null {
  const meals = Array.isArray(plan.meals) ? parseMeals(plan.meals) : [];
  const supplements = Array.isArray(plan.supplements)
    ? parseSupplements(plan.supplements)
    : [];
  const dietNotes = String(plan.dietNotes ?? "");
  const suppNotes = String(plan.suppNotes ?? "");

  const hasDiet = meals.length > 0 || dietNotes.trim().length > 0;
  const hasSupps = supplements.length > 0 || suppNotes.trim().length > 0;

  if (!hasDiet && !hasSupps) return null;
  return { hasDiet, hasSupps, dietNotes, meals, suppNotes, supplements };
}

// ─── Preview sub-components ───────────────────────────────────────────────────

function DietPreviewCard({
  data,
  existingMeals,
}: {
  data: NutritionImportData;
  existingMeals: DietMeal[];
}) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [mealsExpanded, setMealsExpanded] = useState(false);

  const filledMeals = data.meals.filter((m) => m.content.trim().length > 0);
  const notes = data.dietNotes.trim();
  const longNotes = notes.length > 120;
  const dayTypeCount = data.dayTypePlans ? Object.keys(data.dayTypePlans).length : 0;
  const preservedCount = existingMeals.filter(
    (e) =>
      e.content.trim().length > 0 &&
      !data.meals.some((m) => m.label.toLowerCase() === e.label.toLowerCase())
  ).length;

  return (
    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Utensils className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-xs font-semibold">Diet Plan</p>
        </div>
        <div className="flex gap-1 shrink-0 flex-wrap justify-end">
          {dayTypeCount > 0 && (
            <Badge className="text-xs h-5 bg-green-500/20 text-green-700 dark:text-green-400 border-0">
              {dayTypeCount} day type{dayTypeCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {notes && (
            <Badge variant="secondary" className="text-xs h-5">
              {filledMeals.length > 0 ? `notes + ${filledMeals.length} meals` : "plan text"}
            </Badge>
          )}
          {!notes && filledMeals.length > 0 && (
            <Badge variant="secondary" className="text-xs h-5">
              {filledMeals.length} meal{filledMeals.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Day-type summary */}
      {dayTypeCount > 0 && (
        <div className="pl-6 space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            → Day-type plans detected
          </p>
          {Object.entries(data.dayTypePlans!).map(([key, meals]) => (
            <p key={key} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </span>
              {" — "}
              {meals!.filter((m) => m.content.trim()).length} meal
              {meals!.filter((m) => m.content.trim()).length !== 1 ? "s" : ""}
            </p>
          ))}
        </div>
      )}

      {/* Notes / overview text */}
      {notes && (
        <div className="pl-6 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            → Diet Plan overview
          </p>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
            {longNotes && !notesExpanded ? notes.slice(0, 120) + "…" : notes}
          </p>
          {longNotes && (
            <button
              onClick={() => setNotesExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {notesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {notesExpanded ? "Show less" : `Show all (${notes.length} chars)`}
            </button>
          )}
        </div>
      )}

      {/* Structured meals */}
      {filledMeals.length > 0 && (
        <div className="pl-6">
          <button
            onClick={() => setMealsExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {mealsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {mealsExpanded ? "Hide" : "Show"} meals
          </button>
          {mealsExpanded && (
            <div className="space-y-1 mt-1">
              {filledMeals.map((m) => (
                <div key={m.label} className="text-xs">
                  <span className="font-medium text-foreground">{m.label}</span>
                  <span className="text-muted-foreground">
                    {" — "}
                    {m.content.length > 60 ? m.content.slice(0, 60) + "…" : m.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {preservedCount > 0 && (
        <p className="text-xs text-muted-foreground pl-6">
          {preservedCount} existing meal{preservedCount !== 1 ? "s" : ""} not in file will be kept
        </p>
      )}
    </div>
  );
}

function SuppsPreviewCard({
  data,
  existingSupps,
}: {
  data: NutritionImportData;
  existingSupps: NutritionSupplement[];
}) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [suppsExpanded, setSuppsExpanded] = useState(false);

  const incoming = data.supplements;
  const notes = data.suppNotes.trim();
  const longNotes = notes.length > 120;
  const newCount = incoming.filter(
    (s) => !existingSupps.some((e) => e.name.toLowerCase() === s.name.toLowerCase())
  ).length;
  const updatedCount = incoming.filter((s) =>
    existingSupps.some((e) => e.name.toLowerCase() === s.name.toLowerCase())
  ).length;
  const keptCount = existingSupps.filter(
    (e) => !incoming.some((s) => s.name.toLowerCase() === e.name.toLowerCase())
  ).length;

  return (
    <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <p className="text-xs font-semibold">Supplements Plan</p>
        </div>
        <div className="flex gap-1 shrink-0">
          {notes && (
            <Badge variant="secondary" className="text-xs h-5">
              {incoming.length > 0 ? `notes + ${incoming.length} supps` : "plan text"}
            </Badge>
          )}
          {!notes && incoming.length > 0 && (
            <Badge variant="secondary" className="text-xs h-5">
              {incoming.length} supplement{incoming.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Notes / overview text */}
      {notes && (
        <div className="pl-6 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            → Supplements Plan overview
          </p>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
            {longNotes && !notesExpanded ? notes.slice(0, 120) + "…" : notes}
          </p>
          {longNotes && (
            <button
              onClick={() => setNotesExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {notesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {notesExpanded ? "Show less" : `Show all (${notes.length} chars)`}
            </button>
          )}
        </div>
      )}

      {/* Structured supplements list */}
      {incoming.length > 0 && (
        <div className="pl-6">
          <button
            onClick={() => setSuppsExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {suppsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {suppsExpanded ? "Hide" : "Show"} supplements
          </button>
          {suppsExpanded && (
            <div className="space-y-1 mt-1">
              {incoming.map((s) => {
                const isUpdate = existingSupps.some(
                  (e) => e.name.toLowerCase() === s.name.toLowerCase()
                );
                return (
                  <div key={s.id} className="flex items-center gap-1.5 text-xs flex-wrap">
                    <span className="font-medium text-foreground">{s.name}</span>
                    {s.dose && <span className="text-muted-foreground">— {s.dose}</span>}
                    {s.timing && <span className="text-muted-foreground">· {s.timing}</span>}
                    {isUpdate && (
                      <Badge className="text-[10px] h-4 px-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-0">
                        update
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Change summary (only for structured supplements) */}
      {incoming.length > 0 && (
        <div className="flex gap-3 pl-6">
          {newCount > 0 && (
            <span className="text-xs text-green-600 dark:text-green-400">+{newCount} new</span>
          )}
          {updatedCount > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-400">~{updatedCount} updated</span>
          )}
          {keptCount > 0 && (
            <span className="text-xs text-muted-foreground">{keptCount} kept</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Scope selector ───────────────────────────────────────────────────────────

type ImportScope = "both" | "diet" | "supps";

const SCOPE_OPTIONS: { value: ImportScope; label: string }[] = [
  { value: "both",  label: "Import Both"  },
  { value: "diet",  label: "Diet only"    },
  { value: "supps", label: "Supps only"   },
];

function ScopeSelector({
  scope,
  onChange,
}: {
  scope: ImportScope;
  onChange: (s: ImportScope) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">What to import:</p>
      <div className="flex gap-2">
        {SCOPE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={cn(
              "flex-1 text-xs py-2 px-2 rounded-lg border transition-colors font-medium",
              scope === value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Step = "idle" | "preview" | "success";

export default function NutritionImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<NutritionImportData | null>(null);
  const [scope, setScope] = useState<ImportScope>("both");
  const [successMsg, setSuccessMsg] = useState("");

  const nutritionPlan = useAppStore((s) => s.nutritionPlan);
  const setNutritionPlan = useAppStore((s) => s.setNutritionPlan);

  // ── File processing ───────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    file.text().then((text) => {
      try {
        const raw = JSON.parse(text);
        const data = parseNutritionFile(raw);

        if (!data) {
          toast.error("No nutrition data recognised in this file.", {
            description:
              'Expected: { type:"nutrition_only", dietSupps:{dietPlan, suppsPlan} }, ' +
              '{ dietPlan, suppsPlan }, or an Ironclad backup.',
          });
          return;
        }

        setParsed(data);
        setScope(data.hasDiet && data.hasSupps ? "both" : data.hasDiet ? "diet" : "supps");
        setStep("preview");
      } catch {
        toast.error("Could not parse the file.", {
          description: "Make sure it's a valid JSON file.",
        });
      }
    });
  }, []);

  // ── Drag & drop ───────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) processFile(file);
    },
    [processFile]
  );

  // ── Confirm import ────────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    if (!parsed) return;
    setImporting(true);

    try {
      let updated: NutritionPlan = { ...nutritionPlan };

      // ── Diet merge ──────────────────────────────────────────────────────
      if (scope === "both" || scope === "diet") {
        // Build label→content map, concatenating when multiple JSON keys
        // map to the same slot (e.g. breakfast + preWorkout both → Meal 1)
        const importedMealMap = new Map<string, string>();
        for (const m of parsed.meals) {
          const key = m.label.toLowerCase();
          const existing = importedMealMap.get(key);
          importedMealMap.set(key, existing ? `${existing}\n\n${m.content}` : m.content);
        }

        // Build the merged meal list from default slots, imported wins
        const mergedMeals: DietMeal[] = DEFAULT_MEAL_LABELS.map((label) => ({
          label,
          content:
            importedMealMap.get(label.toLowerCase()) ??
            nutritionPlan.meals.find((m) => m.label === label)?.content ??
            "",
        }));

        // Append any extra labels from the import not in the default set
        for (const meal of parsed.meals) {
          if (
            !DEFAULT_MEAL_LABELS.some(
              (l) => l.toLowerCase() === meal.label.toLowerCase()
            )
          ) {
            mergedMeals.push(meal);
          }
        }

        updated = {
          ...updated,
          dietNotes: parsed.dietNotes.trim() || updated.dietNotes,
          meals: mergedMeals,
        };

        // Merge per-day-type plans if present
        if (parsed.dayTypePlans) {
          updated = {
            ...updated,
            dayTypePlans: {
              ...nutritionPlan.dayTypePlans,
              ...parsed.dayTypePlans,
            },
          };
        }
      }

      // ── Supplements smart merge (by name) ──────────────────────────────
      if (scope === "both" || scope === "supps") {
        // Keep existing supplements that aren't in the import
        const keptSupps = nutritionPlan.supplements.filter(
          (e) =>
            !parsed.supplements.some(
              (s) => s.name.toLowerCase() === e.name.toLowerCase()
            )
        );
        // Imported supps take priority (covers both new additions and updates)
        const mergedSupps = [...keptSupps, ...parsed.supplements];

        updated = {
          ...updated,
          suppNotes: parsed.suppNotes.trim() || updated.suppNotes,
          supplements: mergedSupps,
        };
      }

      setNutritionPlan(updated);

      // Build success message
      const parts: string[] = [];
      if (scope !== "supps" && (parsed.meals.length > 0 || parsed.dietNotes.trim())) {
        const mc = parsed.meals.filter((m) => m.content.trim()).length;
        parts.push(`diet plan${mc > 0 ? ` (${mc} meals)` : ""}`);
      }
      if (scope !== "diet" && (parsed.supplements.length > 0 || parsed.suppNotes.trim())) {
        parts.push(`${parsed.supplements.length} supplement${parsed.supplements.length !== 1 ? "s" : ""}`);
      }
      const msg = parts.length > 0 ? parts.join(" & ") + " imported" : "Plan imported";
      setSuccessMsg(msg);
      setStep("success");
      toast.success("Nutrition plan imported!");
    } catch {
      toast.error("Import failed.");
    } finally {
      setImporting(false);
    }
  }, [parsed, scope, nutritionPlan, setNutritionPlan]);

  const handleReset = useCallback(() => {
    setParsed(null);
    setScope("both");
    setSuccessMsg("");
    setStep("idle");
  }, []);

  // ── Success ───────────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              Nutrition plan imported!
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{successMsg}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={handleReset}>
          Import Another Plan
        </Button>
      </div>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  if (step === "preview" && parsed) {
    const showDiet = scope !== "supps" && parsed.hasDiet;
    const showSupps = scope !== "diet" && parsed.hasSupps;

    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Ready to import</p>
            <p className="text-xs text-muted-foreground">
              {[parsed.hasDiet && "diet plan", parsed.hasSupps && "supplements"]
                .filter(Boolean)
                .join(" & ")}
              {" detected"}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Scope selector — always shown when both present */}
        {parsed.hasDiet && parsed.hasSupps && (
          <ScopeSelector scope={scope} onChange={setScope} />
        )}

        <Separator />

        {/* Preview cards — react to scope selection */}
        <div className="space-y-2">
          {showDiet && (
            <DietPreviewCard
              data={parsed}
              existingMeals={nutritionPlan.meals}
            />
          )}
          {showSupps && (
            <SuppsPreviewCard
              data={parsed}
              existingSupps={nutritionPlan.supplements}
            />
          )}
        </div>

        {/* Arrow hint for both */}
        {showDiet && showSupps && (
          <div className="flex items-center gap-1.5 px-1">
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Each section will be merged independently into the editor above.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleReset}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleConfirm}
            disabled={importing}
          >
            {importing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Import{scope === "both" ? " Both" : scope === "diet" ? " Diet" : " Supps"}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── Idle (drop zone) ──────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-3 cursor-pointer select-none transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        )}
      >
        <div
          className={cn(
            "rounded-full p-3 transition-colors",
            dragOver ? "bg-primary/10" : "bg-muted"
          )}
        >
          <Upload
            className={cn(
              "h-5 w-5 transition-colors",
              dragOver ? "text-primary" : "text-muted-foreground"
            )}
          />
        </div>
        <div className="text-center pointer-events-none">
          <p className="text-sm font-medium">
            {dragOver ? "Drop to import" : "Drop nutrition plan here"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            or click to select a .json file
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      <p className="text-xs text-muted-foreground text-center">
        Accepts Ironclad backups,{" "}
        <code className="bg-muted px-1 py-0.5 rounded text-xs">nutrition-plan</code>, or{" "}
        <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{ dietPlan, suppsPlan }"}</code>{" "}
        JSON.
      </p>
    </div>
  );
}
