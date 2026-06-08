"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Salad,
  Plus,
  Trash2,
  ChevronDown,
  Save,
  Check,
  FileJson,
  Flame,
  Drumstick,
  Wheat,
  Droplet,
  UtensilsCrossed,
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
import { cn } from "@/lib/utils";
import MacroPlanImporter from "@/components/nutrition/MacroPlanImporter";
import type { MacroDayPlan, MacroDayType, MacroFoodItem, MacroMeal, MacroPlan } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyFoodItem(): MacroFoodItem {
  return { id: uid(), name: "", quantity: "", kcal: 0, protein: 0, carbs: 0, fat: 0 };
}

interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

function sumItems(items: MacroFoodItem[]): Totals {
  return items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + (i.kcal || 0),
      protein: acc.protein + (i.protein || 0),
      carbs: acc.carbs + (i.carbs || 0),
      fat: acc.fat + (i.fat || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

const DAY_TYPES: { key: MacroDayType; label: string; icon: typeof Salad }[] = [
  { key: "vegetarian", label: "Vegetarian", icon: Salad },
  { key: "eggetarian", label: "Eggetarian", icon: UtensilsCrossed },
];

// ─── Macro stat row (compact, color-coded) ───────────────────────────────────

function MacroStats({ totals, size = "sm" }: { totals: Totals; size?: "sm" | "md" }) {
  const big = size === "md";
  return (
    <div className={cn("flex items-center flex-wrap gap-x-3 gap-y-1", big ? "text-sm" : "text-xs")}>
      <span className="flex items-center gap-1 font-semibold text-foreground">
        <Flame className={cn(big ? "h-4 w-4" : "h-3 w-3", "text-orange-500")} />
        {Math.round(totals.kcal)} kcal
      </span>
      <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
        <Drumstick className={cn(big ? "h-3.5 w-3.5" : "h-3 w-3")} />
        {Math.round(totals.protein)}g
      </span>
      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <Wheat className={cn(big ? "h-3.5 w-3.5" : "h-3 w-3")} />
        {Math.round(totals.carbs)}g
      </span>
      <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
        <Droplet className={cn(big ? "h-3.5 w-3.5" : "h-3 w-3")} />
        {Math.round(totals.fat)}g
      </span>
    </div>
  );
}

// ─── Food item card (always-editable, lives in horizontal scroller) ──────────

type EditableNumField = "kcal" | "protein" | "carbs" | "fat";

function FoodItemCard({
  item,
  onChange,
  onChangeNumber,
  onDelete,
}: {
  item: MacroFoodItem;
  onChange: (field: "name" | "quantity", value: string) => void;
  onChangeNumber: (field: EditableNumField, value: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="shrink-0 snap-start w-[156px] rounded-xl border border-border bg-card p-2.5 space-y-1.5 relative">
      <button
        onClick={onDelete}
        className="absolute top-1.5 right-1.5 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors z-10"
        aria-label="Remove food item"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      <Input
        value={item.name}
        onChange={(e) => onChange("name", e.target.value)}
        placeholder="Food name"
        className="h-8 text-xs font-medium pr-7"
      />
      <Input
        value={item.quantity}
        onChange={(e) => onChange("quantity", e.target.value)}
        placeholder="Quantity"
        className="h-7 text-xs text-muted-foreground"
      />

      <div className="flex items-center gap-1.5 pt-0.5">
        <Flame className="h-3 w-3 text-orange-500 shrink-0" />
        <Input
          type="number"
          inputMode="numeric"
          value={item.kcal || ""}
          onChange={(e) => onChangeNumber("kcal", e.target.value)}
          placeholder="kcal"
          className="h-7 text-xs text-center px-1"
          min="0"
        />
      </div>

      <div className="grid grid-cols-3 gap-1">
        <div className="space-y-0.5">
          <span className="flex items-center justify-center gap-0.5 text-[9px] font-semibold text-blue-600 dark:text-blue-400">
            <Drumstick className="h-2.5 w-2.5" /> P
          </span>
          <Input
            type="number"
            inputMode="numeric"
            value={item.protein || ""}
            onChange={(e) => onChangeNumber("protein", e.target.value)}
            className="h-7 text-xs text-center px-0.5"
            min="0"
          />
        </div>
        <div className="space-y-0.5">
          <span className="flex items-center justify-center gap-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
            <Wheat className="h-2.5 w-2.5" /> C
          </span>
          <Input
            type="number"
            inputMode="numeric"
            value={item.carbs || ""}
            onChange={(e) => onChangeNumber("carbs", e.target.value)}
            className="h-7 text-xs text-center px-0.5"
            min="0"
          />
        </div>
        <div className="space-y-0.5">
          <span className="flex items-center justify-center gap-0.5 text-[9px] font-semibold text-rose-600 dark:text-rose-400">
            <Droplet className="h-2.5 w-2.5" /> F
          </span>
          <Input
            type="number"
            inputMode="numeric"
            value={item.fat || ""}
            onChange={(e) => onChangeNumber("fat", e.target.value)}
            className="h-7 text-xs text-center px-0.5"
            min="0"
          />
        </div>
      </div>
    </div>
  );
}

function AddFoodItemCard({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="shrink-0 snap-start w-[72px] rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
    >
      <Plus className="h-4 w-4" />
      <span className="text-[10px] font-medium leading-tight text-center px-1">Add food</span>
    </button>
  );
}

// ─── Meal block ───────────────────────────────────────────────────────────────

function MealBlock({
  meal,
  onUpdateItem,
  onUpdateItemNumber,
  onAddItem,
  onDeleteItem,
}: {
  meal: MacroMeal;
  onUpdateItem: (itemId: string, field: "name" | "quantity", value: string) => void;
  onUpdateItemNumber: (itemId: string, field: EditableNumField, value: string) => void;
  onAddItem: () => void;
  onDeleteItem: (itemId: string) => void;
}) {
  const totals = useMemo(() => sumItems(meal.items), [meal.items]);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-muted/40">
        <span className="text-sm font-semibold shrink-0">{meal.name}</span>
        {meal.items.length > 0 && <MacroStats totals={totals} />}
      </div>
      <div className="p-2.5">
        <div className="flex gap-2 overflow-x-auto snap-x snap-proximity pb-1 -mx-1 px-1">
          {meal.items.map((item) => (
            <FoodItemCard
              key={item.id}
              item={item}
              onChange={(field, value) => onUpdateItem(item.id, field, value)}
              onChangeNumber={(field, value) => onUpdateItemNumber(item.id, field, value)}
              onDelete={() => onDeleteItem(item.id)}
            />
          ))}
          <AddFoodItemCard onAdd={onAddItem} />
        </div>
      </div>
    </div>
  );
}

// ─── Save bar ─────────────────────────────────────────────────────────────────

function SaveBar({ dirty, onSave }: { dirty: boolean; onSave: () => void }) {
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
        Save Macro Plan
      </Button>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyDayPlan({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-8 flex flex-col items-center gap-2 text-center px-4">
      <Salad className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.25} />
      <p className="text-xs text-muted-foreground">
        No {label.toLowerCase()} macro plan yet. Import one below to get started.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const LS_DAY_TYPE_KEY = "ironclad-selected-macro-day-type";

export default function MacroPlanContent() {
  const macroPlan = useAppStore((s) => s.macroPlan);
  const planUpdatedAt = useAppStore((s) => s.macroPlan.updatedAt);
  const setMacroPlan = useAppStore((s) => s.setMacroPlan);

  const [expanded, setExpanded] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<MacroDayType>("vegetarian");
  const [draft, setDraft] = useState<MacroDayPlan | null>(null);
  const [dirty, setDirty] = useState(false);

  // Restore last-used day type
  useEffect(() => {
    const saved = localStorage.getItem(LS_DAY_TYPE_KEY);
    if (saved === "vegetarian" || saved === "eggetarian") setSelectedType(saved);
  }, []);

  // Re-sync draft from store whenever the plan or selected type changes
  useEffect(() => {
    const plan = useAppStore.getState().macroPlan;
    const found = plan.dayPlans.find((p) => p.dayType === selectedType) ?? null;
    setDraft(found ? structuredClone(found) : null);
    setDirty(false);
  }, [planUpdatedAt, selectedType]);

  const handleTypeChange = useCallback((key: MacroDayType) => {
    setSelectedType(key);
    localStorage.setItem(LS_DAY_TYPE_KEY, key);
  }, []);

  // ── Draft mutations ──────────────────────────────────────────────────────

  const updateItem = useCallback(
    (mealId: string, itemId: string, field: "name" | "quantity", value: string) => {
      setDraft((d) => {
        if (!d) return d;
        return {
          ...d,
          meals: d.meals.map((m) =>
            m.id !== mealId
              ? m
              : { ...m, items: m.items.map((i) => (i.id !== itemId ? i : { ...i, [field]: value })) }
          ),
        };
      });
      setDirty(true);
    },
    []
  );

  const updateItemNumber = useCallback(
    (mealId: string, itemId: string, field: EditableNumField, value: string) => {
      const num = value === "" ? 0 : parseFloat(value);
      setDraft((d) => {
        if (!d) return d;
        return {
          ...d,
          meals: d.meals.map((m) =>
            m.id !== mealId
              ? m
              : {
                  ...m,
                  items: m.items.map((i) =>
                    i.id !== itemId ? i : { ...i, [field]: isNaN(num) ? 0 : num }
                  ),
                }
          ),
        };
      });
      setDirty(true);
    },
    []
  );

  const addItem = useCallback((mealId: string) => {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        meals: d.meals.map((m) =>
          m.id !== mealId ? m : { ...m, items: [...m.items, emptyFoodItem()] }
        ),
      };
    });
    setDirty(true);
  }, []);

  const deleteItem = useCallback((mealId: string, itemId: string) => {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        meals: d.meals.map((m) =>
          m.id !== mealId ? m : { ...m, items: m.items.filter((i) => i.id !== itemId) }
        ),
      };
    });
    setDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!draft) return;
    const others = macroPlan.dayPlans.filter((p) => p.dayType !== draft.dayType);
    const updated: MacroPlan = { ...macroPlan, dayPlans: [...others, draft] };
    setMacroPlan(updated);
    setDirty(false);
    toast.success(`${dayTypeMeta(selectedType).label} macro plan saved!`);
  }, [draft, macroPlan, setMacroPlan, selectedType]);

  function dayTypeMeta(key: MacroDayType) {
    return DAY_TYPES.find((d) => d.key === key)!;
  }

  const dayTotals = useMemo(
    () => (draft ? sumItems(draft.meals.flatMap((m) => m.items)) : null),
    [draft]
  );

  const activeMeta = dayTypeMeta(selectedType);
  const totalItems = draft ? draft.meals.reduce((a, m) => a + m.items.length, 0) : 0;

  return (
    <Card>
      <CardHeader className={expanded ? "pb-3" : "pb-4"}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="rounded-lg bg-orange-500/10 p-1.5 shrink-0">
              <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">Macro Plan</CardTitle>
              <CardDescription className="text-xs">
                {draft
                  ? `${draft.meals.length} meal${draft.meals.length !== 1 ? "s" : ""} · ${totalItems} items · ${activeMeta.label}`
                  : "Structured calories & macros per meal"}
              </CardDescription>
            </div>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0"
            aria-label={expanded ? "Collapse macro plan" : "Expand macro plan"}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Day-type selector */}
          <div className="flex gap-1.5">
            {DAY_TYPES.map((dt) => {
              const Icon = dt.icon;
              const hasPlan = macroPlan.dayPlans.some((p) => p.dayType === dt.key);
              return (
                <button
                  key={dt.key}
                  onClick={() => handleTypeChange(dt.key)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                    selectedType === dt.key
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {dt.label}
                  {!hasPlan && (
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      selectedType === dt.key ? "bg-primary-foreground/50" : "bg-muted-foreground/30"
                    )} />
                  )}
                </button>
              );
            })}
          </div>

          {draft && dayTotals ? (
            <>
              {/* Day totals banner */}
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-3.5 py-3 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Daily total{draft.label ? ` · ${draft.label}` : ""}
                </p>
                <MacroStats totals={dayTotals} size="md" />
              </div>

              {/* Meals */}
              <div className="space-y-3">
                {draft.meals.map((meal) => (
                  <MealBlock
                    key={meal.id}
                    meal={meal}
                    onUpdateItem={(itemId, field, value) => updateItem(meal.id, itemId, field, value)}
                    onUpdateItemNumber={(itemId, field, value) => updateItemNumber(meal.id, itemId, field, value)}
                    onAddItem={() => addItem(meal.id)}
                    onDeleteItem={(itemId) => deleteItem(meal.id, itemId)}
                  />
                ))}
              </div>

              <Separator />
              <SaveBar dirty={dirty} onSave={handleSave} />
            </>
          ) : (
            <EmptyDayPlan label={activeMeta.label} />
          )}

          {/* ── Import ────────────────────────────────────── */}
          <div className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setImportOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3.5 py-3 text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-muted p-1.5 shrink-0">
                  <FileJson className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Import Macro Plan</p>
                  <p className="text-xs text-muted-foreground">Drag & drop a structured macro JSON</p>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
                  importOpen && "rotate-180"
                )}
              />
            </button>
            {importOpen && (
              <>
                <Separator />
                <div className="p-3.5">
                  <MacroPlanImporter />
                </div>
              </>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
