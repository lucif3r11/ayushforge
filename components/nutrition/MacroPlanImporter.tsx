"use client";

import { useState, useCallback, useRef, DragEvent } from "react";
import {
  Upload,
  X,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Salad,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { MacroPlan, MacroDayPlan, MacroMeal, MacroFoodItem, MacroDayType } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function toNumber(val: unknown): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    if (!isNaN(n)) return n;
  }
  return 0;
}

const DAY_TYPE_ALIASES: Record<string, MacroDayType> = {
  vegetarian: "vegetarian",
  veg: "vegetarian",
  vegtraining: "vegetarian",
  eggetarian: "eggetarian",
  egg: "eggetarian",
  eggtraining: "eggetarian",
  nonveg: "eggetarian",
  "non-veg": "eggetarian",
  refeed: "refeed",
  carbrefeed: "refeed",
  wednesday: "refeed",
  sunday: "sunday",
  egghyrox: "sunday",
};

function normalizeDayType(val: unknown): MacroDayType | null {
  if (typeof val !== "string") return null;
  const key = val.toLowerCase().trim().replace(/[\s_-]/g, "");
  if (DAY_TYPE_ALIASES[key]) return DAY_TYPE_ALIASES[key];

  // Fall back to fuzzy matching against descriptive labels like
  // "Veg Training Day" / "Egg Training Day" / "Refeed (Wednesday)" / "Sunday — Egg + Hyrox"
  if (key.includes("egg")) return "eggetarian";
  if (key.includes("veg")) return "vegetarian";
  if (key.includes("refeed") || key.includes("wednesday") || key.includes("carb")) return "refeed";
  if (key.includes("sunday") || key.includes("hyrox")) return "sunday";
  return null;
}

const DAY_TYPE_LABELS: Record<MacroDayType, string> = {
  vegetarian: "Vegetarian",
  eggetarian: "Eggetarian",
  refeed: "Refeed",
  sunday: "Sunday",
};

function dayTypeLabel(t: MacroDayType): string {
  return DAY_TYPE_LABELS[t];
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseFoodItem(raw: unknown): MacroFoodItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const name = String(item.name ?? item.food ?? "").trim();
  if (!name) return null;
  return {
    id: uid(),
    name,
    quantity: String(item.quantity ?? item.qty ?? item.amount ?? "").trim(),
    kcal: toNumber(item.kcal ?? item.calories ?? item.kcals),
    protein: toNumber(item.protein ?? item.proteinG),
    carbs: toNumber(item.carbs ?? item.carbsG ?? item.carbohydrates),
    fat: toNumber(item.fat ?? item.fatG),
  };
}

function parseMeal(raw: unknown): MacroMeal | null {
  if (!raw || typeof raw !== "object") return null;
  const meal = raw as Record<string, unknown>;
  const name = String(meal.name ?? meal.label ?? "").trim();
  if (!name) return null;
  const itemsRaw = Array.isArray(meal.items)
    ? meal.items
    : Array.isArray(meal.foods)
      ? meal.foods
      : [];
  const items = itemsRaw
    .map(parseFoodItem)
    .filter((i): i is MacroFoodItem => i !== null);
  return { id: uid(), name, items };
}

function parseDayPlan(raw: unknown): MacroDayPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const plan = raw as Record<string, unknown>;
  const dayType = normalizeDayType(plan.dayType ?? plan.type ?? plan.name ?? plan.day);
  if (!dayType) return null;
  const mealsRaw = Array.isArray(plan.meals) ? plan.meals : [];
  const meals = mealsRaw
    .map(parseMeal)
    .filter((m): m is MacroMeal => m !== null);
  if (meals.length === 0) return null;
  const label = typeof plan.label === "string" && plan.label.trim() ? plan.label.trim() : undefined;
  return { id: uid(), dayType, label, meals };
}

interface MacroImportData {
  dayPlans: MacroDayPlan[];
}

function parseMacroPlanFile(raw: unknown): MacroImportData | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // Accept { type: "nutrition_only", dayTypes: [...] } (preferred format),
  // { type: "ironclad-macro-plan", dayPlans: [...] } / relaxed { dayPlans: [...] },
  // or a full Ironclad backup with data.macroPlan
  let dayPlansRaw: unknown[] | null = null;

  if (Array.isArray(obj.dayTypes)) {
    dayPlansRaw = obj.dayTypes;
  } else if (Array.isArray(obj.dayPlans)) {
    dayPlansRaw = obj.dayPlans;
  } else if (obj.appName === "Ironclad" && obj.data && typeof obj.data === "object") {
    const d = (obj.data as Record<string, unknown>).macroPlan;
    if (d && typeof d === "object" && Array.isArray((d as Record<string, unknown>).dayPlans)) {
      dayPlansRaw = (d as Record<string, unknown>).dayPlans as unknown[];
    }
  } else if (obj.macroPlan && typeof obj.macroPlan === "object") {
    const d = obj.macroPlan as Record<string, unknown>;
    if (Array.isArray(d.dayPlans)) dayPlansRaw = d.dayPlans;
  }

  if (!dayPlansRaw) return null;

  const dayPlans = dayPlansRaw
    .map(parseDayPlan)
    .filter((p): p is MacroDayPlan => p !== null);

  if (dayPlans.length === 0) return null;
  return { dayPlans };
}

// ─── Totals helper ────────────────────────────────────────────────────────────

function sumItems(items: MacroFoodItem[]) {
  return items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      protein: acc.protein + i.protein,
      carbs: acc.carbs + i.carbs,
      fat: acc.fat + i.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function dayItemCount(plan: MacroDayPlan): number {
  return plan.meals.reduce((a, m) => a + m.items.length, 0);
}

// ─── Preview card ─────────────────────────────────────────────────────────────

function DayPlanPreview({
  plan,
  isReplacing,
}: {
  plan: MacroDayPlan;
  isReplacing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const totals = sumItems(plan.meals.flatMap((m) => m.items));

  return (
    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Salad className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">
              {dayTypeLabel(plan.dayType)}
              {plan.label ? ` — ${plan.label}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {plan.meals.length} meal{plan.meals.length !== 1 ? "s" : ""} ·{" "}
              {dayItemCount(plan)} item{dayItemCount(plan) !== 1 ? "s" : ""} ·{" "}
              {Math.round(totals.kcal)} kcal/day
            </p>
          </div>
        </div>
        {isReplacing && (
          <Badge className="text-[10px] h-5 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-0 shrink-0">
            replaces existing
          </Badge>
        )}
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pl-6"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {expanded ? "Hide" : "Show"} meals
      </button>

      {expanded && (
        <div className="pl-6 space-y-1.5">
          {plan.meals.map((m) => {
            const mt = sumItems(m.items);
            return (
              <div key={m.id} className="text-xs">
                <span className="font-medium text-foreground">{m.name}</span>
                <span className="text-muted-foreground">
                  {" — "}
                  {m.items.length} item{m.items.length !== 1 ? "s" : ""} ·{" "}
                  {Math.round(mt.kcal)} kcal
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Step = "idle" | "preview" | "success";

export default function MacroPlanImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<MacroImportData | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const macroPlan = useAppStore((s) => s.macroPlan);
  const setMacroPlan = useAppStore((s) => s.setMacroPlan);

  const processFile = useCallback((file: File) => {
    file.text().then((text) => {
      try {
        const raw = JSON.parse(text);
        const data = parseMacroPlanFile(raw);

        if (!data) {
          toast.error("No nutrition plan recognised in this file.", {
            description:
              'Expected { type: "nutrition_only", dayTypes: [...] } — see Ironclad_Nutrition_Format.md.',
          });
          return;
        }

        setParsed(data);
        setStep("preview");
      } catch {
        toast.error("Could not parse the file.", {
          description: "Make sure it's a valid JSON file.",
        });
      }
    });
  }, []);

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

  const handleConfirm = useCallback(() => {
    if (!parsed) return;
    setImporting(true);
    try {
      // Replace any existing day plan with a matching dayType; keep the rest
      const incomingTypes = new Set(parsed.dayPlans.map((p) => p.dayType));
      const kept = macroPlan.dayPlans.filter((p) => !incomingTypes.has(p.dayType));
      const merged: MacroPlan = {
        ...macroPlan,
        dayPlans: [...kept, ...parsed.dayPlans],
      };
      setMacroPlan(merged);

      const totalMeals = parsed.dayPlans.reduce((a, p) => a + p.meals.length, 0);
      const totalItems = parsed.dayPlans.reduce((a, p) => a + dayItemCount(p), 0);
      setSuccessMsg(
        `${parsed.dayPlans.length} day plan${parsed.dayPlans.length !== 1 ? "s" : ""} · ` +
        `${totalMeals} meal${totalMeals !== 1 ? "s" : ""} · ${totalItems} food item${totalItems !== 1 ? "s" : ""}`
      );
      setStep("success");
      toast.success("Nutrition plan imported!");
    } catch {
      toast.error("Import failed.");
    } finally {
      setImporting(false);
    }
  }, [parsed, macroPlan, setMacroPlan]);

  const handleReset = useCallback(() => {
    setParsed(null);
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
    const existingTypes = new Set(macroPlan.dayPlans.map((p) => p.dayType));
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Ready to import</p>
            <p className="text-xs text-muted-foreground">
              {parsed.dayPlans.length} day plan{parsed.dayPlans.length !== 1 ? "s" : ""} detected
            </p>
          </div>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <Separator />

        <div className="space-y-2">
          {parsed.dayPlans.map((p) => (
            <DayPlanPreview key={p.id} plan={p} isReplacing={existingTypes.has(p.dayType)} />
          ))}
        </div>

        <div className="flex items-center gap-1.5 px-1">
          <Flame className="h-3 w-3 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Day types not in this file are kept untouched.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleReset} disabled={importing}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1 gap-1.5" onClick={handleConfirm} disabled={importing}>
            {importing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Import Plan
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
        <div className={cn("rounded-full p-3 transition-colors", dragOver ? "bg-primary/10" : "bg-muted")}>
          <Upload className={cn("h-5 w-5 transition-colors", dragOver ? "text-primary" : "text-muted-foreground")} />
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
        Accepts{" "}
        <code className="bg-muted px-1 py-0.5 rounded text-xs">nutrition_only</code>{" "}
        JSON — see <span className="font-medium">Ironclad_Nutrition_Format.md</span> for the spec.
      </p>
    </div>
  );
}
