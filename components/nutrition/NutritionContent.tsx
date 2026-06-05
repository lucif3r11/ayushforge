"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Utensils,
  Pill,
  Plus,
  Trash2,
  Save,
  Check,
  ChevronDown,
  FileJson,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import NutritionImporter from "@/components/nutrition/NutritionImporter";
import type { NutritionSupplement, DietMeal, DayTypeKey, NutritionPlan } from "@/lib/types";
import { DAY_TYPE_KEYS } from "@/lib/types";

// ─── Day-type config ──────────────────────────────────────────────────────────

const DAY_TYPES: { key: DayTypeKey; label: string; days: string }[] = [
  { key: "vegTraining", label: "Veg Training",  days: "Mon · Tue · Sat" },
  { key: "eggTraining", label: "Egg Training",  days: "Thu · Fri" },
  { key: "wednesday",   label: "Refeed",        days: "Wednesday" },
  { key: "sunday",      label: "Sunday",        days: "Egg + Hyrox" },
];

// Canonical slot order (must match lib/store.ts DEFAULT_MEALS)
const MEAL_SLOTS = [
  "Breakfast",
  "Pre-Workout",
  "Post-Workout",
  "Snacks / Standalones",
  "Dinner",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptySupp(): NutritionSupplement {
  return { id: uid(), name: "", dose: "", timing: "", notes: "" };
}

/** Build a full set of meal slots for a given day-type plan, filling gaps from fallback. */
function buildDisplayMeals(
  dayPlan: DietMeal[] | undefined,
  fallback: DietMeal[]
): DietMeal[] {
  return MEAL_SLOTS.map((label) => ({
    label,
    content:
      dayPlan?.find((m) => m.label === label)?.content ??
      fallback.find((m) => m.label === label)?.content ??
      "",
  }));
}

// ─── Auto-height meal row ─────────────────────────────────────────────────────

function MealRow({
  meal,
  index,
  onChange,
}: {
  meal: DietMeal;
  index: number;
  onChange: (content: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [meal.content]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
      onChange(e.target.value);
    },
    [onChange]
  );

  const filled = meal.content.trim().length > 0;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40">
        <span className="text-xs font-semibold text-foreground">{meal.label}</span>
        {filled && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
      </div>
      <div className="px-3 py-2">
        <textarea
          ref={ref}
          value={meal.content}
          onChange={handleInput}
          placeholder={meal.label}
          rows={1}
          className="w-full text-sm resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted-foreground leading-relaxed"
          style={{ minHeight: "32px" }}
        />
      </div>
    </div>
  );
}

// ─── Supplement row ───────────────────────────────────────────────────────────

function SuppRow({
  supp,
  onUpdate,
  onDelete,
}: {
  supp: NutritionSupplement;
  onUpdate: (field: keyof NutritionSupplement, value: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-border p-3 space-y-2 bg-muted/20">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Supplement name"
          value={supp.name}
          onChange={(e) => onUpdate("name", e.target.value)}
          className="flex-1 h-9 text-sm"
        />
        <button
          onClick={onDelete}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Dose (e.g. 5 g)"
          value={supp.dose}
          onChange={(e) => onUpdate("dose", e.target.value)}
          className="h-9 text-sm"
        />
        <Input
          placeholder="Timing (e.g. AM)"
          value={supp.timing}
          onChange={(e) => onUpdate("timing", e.target.value)}
          className="h-9 text-sm"
        />
      </div>
      <Input
        placeholder="Notes (optional)"
        value={supp.notes ?? ""}
        onChange={(e) => onUpdate("notes", e.target.value)}
        className="h-9 text-sm text-muted-foreground"
      />
    </div>
  );
}

// ─── Save bar ─────────────────────────────────────────────────────────────────

function SaveBar({ dirty, onSave, label }: { dirty: boolean; onSave: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between pt-1">
      {dirty ? (
        <span className="text-xs text-amber-500 font-medium">Unsaved changes</span>
      ) : (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Check className="h-3 w-3 text-green-500" />
          Saved
        </span>
      )}
      <Button size="sm" onClick={onSave} disabled={!dirty} className="gap-1.5">
        <Save className="h-3.5 w-3.5" />
        {label}
      </Button>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NutritionSkeleton() {
  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-32 rounded bg-muted" />
        <div className="h-4 w-52 rounded bg-muted" />
      </div>
      <div className="h-64 rounded-xl bg-muted" />
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const LS_DAY_TYPE_KEY = "ironclad-selected-day-type";

export default function NutritionContent() {
  const [mounted, setMounted] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dietExpanded, setDietExpanded] = useState(true);
  const [suppsExpanded, setSuppsExpanded] = useState(true);

  // Persist last-used day type across page loads
  const [selectedDayType, setSelectedDayType] = useState<DayTypeKey>("vegTraining");

  const nutritionPlan = useAppStore((s) => s.nutritionPlan);
  const planUpdatedAt = useAppStore((s) => s.nutritionPlan.updatedAt);
  const setNutritionPlan = useAppStore((s) => s.setNutritionPlan);
  const activeBlock = useAppStore((s) => s.blocks.find((b) => b.isActive));

  const [meals, setMeals] = useState<DietMeal[]>([]);
  const [dietDirty, setDietDirty] = useState(false);

  const [supplements, setSupplements] = useState<NutritionSupplement[]>([]);
  const [suppDirty, setSuppDirty] = useState(false);

  // Restore last-used day type on mount
  useEffect(() => {
    const saved = localStorage.getItem(LS_DAY_TYPE_KEY) as DayTypeKey | null;
    if (saved && (DAY_TYPE_KEYS as readonly string[]).includes(saved)) {
      setSelectedDayType(saved);
    }
  }, []);

  // Hydrate / re-sync whenever the store plan or selected day type changes
  useEffect(() => {
    const plan = useAppStore.getState().nutritionPlan;
    const dayPlan = plan.dayTypePlans?.[selectedDayType];
    setMeals(buildDisplayMeals(dayPlan, plan.meals));
    setDietDirty(false);
    setSupplements(plan.supplements.map((s) => ({ ...s })));
    setSuppDirty(false);
    if (!mounted) setMounted(true);
  }, [planUpdatedAt, selectedDayType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Day-type selection ────────────────────────────────────────────────────

  const handleDayTypeChange = useCallback((key: DayTypeKey) => {
    setSelectedDayType(key);
    localStorage.setItem(LS_DAY_TYPE_KEY, key);
  }, []);

  // ── Diet handlers ─────────────────────────────────────────────────────────

  const handleMealChange = useCallback((index: number, content: string) => {
    setMeals((prev) => prev.map((m, i) => (i === index ? { ...m, content } : m)));
    setDietDirty(true);
  }, []);

  const saveDiet = useCallback(() => {
    const dayLabel = DAY_TYPES.find((d) => d.key === selectedDayType)?.label ?? "Diet";
    const updated: NutritionPlan = {
      ...nutritionPlan,
      dayTypePlans: {
        ...nutritionPlan.dayTypePlans,
        [selectedDayType]: meals,
      },
    };
    setNutritionPlan(updated);
    setDietDirty(false);
    toast.success(`${dayLabel} plan saved!`);
  }, [nutritionPlan, setNutritionPlan, meals, selectedDayType]);

  // ── Supplement handlers ───────────────────────────────────────────────────

  const addSupp = useCallback(() => {
    setSupplements((prev) => [...prev, emptySupp()]);
    setSuppDirty(true);
  }, []);

  const updateSupp = useCallback(
    (id: string, field: keyof NutritionSupplement, value: string) => {
      setSupplements((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
      setSuppDirty(true);
    },
    []
  );

  const deleteSupp = useCallback((id: string) => {
    setSupplements((prev) => prev.filter((s) => s.id !== id));
    setSuppDirty(true);
  }, []);

  const saveSupps = useCallback(() => {
    setNutritionPlan({ ...nutritionPlan, supplements });
    setSuppDirty(false);
    toast.success("Supplements plan saved!");
  }, [nutritionPlan, setNutritionPlan, supplements]);

  if (!mounted) return <NutritionSkeleton />;

  const filledMeals = meals.filter((m) => m.content.trim().length > 0).length;
  const namedSupps = supplements.filter((s) => s.name.trim().length > 0).length;
  const activeDayType = DAY_TYPES.find((d) => d.key === selectedDayType)!;

  return (
    <div className="p-4 pb-8 space-y-5 max-w-lg mx-auto">

      {/* ── Header ──────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold">Nutrition</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Diet & Supplements Plan</p>
      </div>

      {/* ── Active block context ─────────────────────── */}
      {activeBlock && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-xs text-muted-foreground">Plan for:</span>
          <Badge variant="secondary" className="text-xs">{activeBlock.name}</Badge>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          DIET PLAN
      ══════════════════════════════════════════════ */}
      <Card>
        <CardHeader className={dietExpanded ? "pb-3" : "pb-4"}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="rounded-lg bg-green-500/10 p-1.5 shrink-0">
                <Utensils className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">Diet Plan</CardTitle>
                <CardDescription className="text-xs">
                  {filledMeals > 0
                    ? `${filledMeals} meal${filledMeals !== 1 ? "s" : ""} · ${activeDayType.label}`
                    : "Select a day type below"}
                </CardDescription>
              </div>
            </div>
            <button
              onClick={() => setDietExpanded((v) => !v)}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0"
              aria-label={dietExpanded ? "Collapse diet plan" : "Expand diet plan"}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${dietExpanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </CardHeader>

        {dietExpanded && (
          <CardContent className="space-y-4">
            {/* ── Day-type selector ──────────────────── */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
              {DAY_TYPES.map((dt) => (
                <button
                  key={dt.key}
                  onClick={() => handleDayTypeChange(dt.key)}
                  className={cn(
                    "flex-shrink-0 text-left px-3 py-2 rounded-lg border transition-all",
                    selectedDayType === dt.key
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                  )}
                >
                  <p className="text-xs font-bold leading-tight">{dt.label}</p>
                  <p className={cn("text-[10px] leading-tight mt-0.5", selectedDayType === dt.key ? "opacity-70" : "opacity-55")}>
                    {dt.days}
                  </p>
                </button>
              ))}
            </div>

            {/* ── Meal slots ─────────────────────────── */}
            <div className="space-y-2">
              {meals.map((meal, i) => (
                <MealRow
                  key={meal.label}
                  meal={meal}
                  index={i}
                  onChange={(content) => handleMealChange(i, content)}
                />
              ))}
            </div>

            <Separator />
            <SaveBar dirty={dietDirty} onSave={saveDiet} label={`Save ${activeDayType.label}`} />
          </CardContent>
        )}
      </Card>

      {/* ══════════════════════════════════════════════
          SUPPLEMENTS PLAN
      ══════════════════════════════════════════════ */}
      <Card>
        <CardHeader className={suppsExpanded ? "pb-3" : "pb-4"}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="rounded-lg bg-purple-500/10 p-1.5 shrink-0">
                <Pill className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">Supplements Plan</CardTitle>
                <CardDescription className="text-xs">
                  {namedSupps > 0
                    ? `${namedSupps} supplement${namedSupps !== 1 ? "s" : ""} in your stack`
                    : "Add your supplement stack"}
                </CardDescription>
              </div>
            </div>
            <button
              onClick={() => setSuppsExpanded((v) => !v)}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0"
              aria-label={suppsExpanded ? "Collapse supplements" : "Expand supplements"}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${suppsExpanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </CardHeader>

        {suppsExpanded && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {supplements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-6 flex flex-col items-center gap-2 text-center">
                  <Pill className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.25} />
                  <p className="text-xs text-muted-foreground">
                    No supplements added yet. Tap below to add one.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supplements.map((s) => (
                    <SuppRow
                      key={s.id}
                      supp={s}
                      onUpdate={(field, value) => updateSupp(s.id, field, value)}
                      onDelete={() => deleteSupp(s.id)}
                    />
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-dashed"
                onClick={addSupp}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Supplement
              </Button>
            </div>
            <Separator />
            <SaveBar dirty={suppDirty} onSave={saveSupps} label="Save Supps Plan" />
          </CardContent>
        )}
      </Card>

      {/* ══════════════════════════════════════════════
          IMPORT PLAN
      ══════════════════════════════════════════════ */}
      <Card>
        <button
          onClick={() => setImportOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-muted p-1.5 shrink-0">
              <FileJson className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Import Plan</p>
              <p className="text-xs text-muted-foreground">Drag & drop a nutrition plan JSON</p>
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
              importOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {importOpen && (
          <>
            <Separator />
            <CardContent className="pt-4 pb-4">
              <NutritionImporter />
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
