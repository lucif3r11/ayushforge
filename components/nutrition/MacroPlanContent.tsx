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
  RefreshCw,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  { key: "refeed", label: "Refeed", icon: RefreshCw },
  { key: "sunday", label: "Sunday", icon: Sun },
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

// ─── Editable food row (lives inside a meal table) ───────────────────────────

type EditableNumField = "kcal" | "protein" | "carbs" | "fat";

function cellInputClass(extra?: string) {
  return cn(
    "w-full min-w-0 bg-transparent outline-none text-xs leading-tight",
    "placeholder:text-muted-foreground/40 rounded px-0.5 py-1 -mx-0.5",
    "focus:bg-muted/60 transition-colors",
    // Hide number input spin buttons — they inflate scrollWidth and clip digits in narrow cells
    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0",
    extra
  );
}

function FoodRow({
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
    <tr className="border-t border-border/60">
      <td className="py-1 pl-3 pr-1">
        <input
          value={item.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Food name"
          className={cellInputClass("font-medium text-foreground")}
        />
      </td>
      <td className="py-1 pr-1">
        <input
          value={item.quantity}
          onChange={(e) => onChange("quantity", e.target.value)}
          placeholder="Qty"
          className={cellInputClass("text-muted-foreground")}
        />
      </td>
      <td className="py-1 pr-1">
        <input
          type="number"
          inputMode="numeric"
          value={item.kcal || ""}
          onChange={(e) => onChangeNumber("kcal", e.target.value)}
          placeholder="0"
          min="0"
          className={cellInputClass("text-right font-medium")}
        />
      </td>
      <td className="py-1 pr-1">
        <input
          type="number"
          inputMode="numeric"
          value={item.protein || ""}
          onChange={(e) => onChangeNumber("protein", e.target.value)}
          placeholder="0"
          min="0"
          className={cellInputClass("text-right text-blue-600 dark:text-blue-400")}
        />
      </td>
      <td className="py-1 pr-1">
        <input
          type="number"
          inputMode="numeric"
          value={item.carbs || ""}
          onChange={(e) => onChangeNumber("carbs", e.target.value)}
          placeholder="0"
          min="0"
          className={cellInputClass("text-right text-amber-600 dark:text-amber-400")}
        />
      </td>
      <td className="py-1 pr-1">
        <input
          type="number"
          inputMode="numeric"
          value={item.fat || ""}
          onChange={(e) => onChangeNumber("fat", e.target.value)}
          placeholder="0"
          min="0"
          className={cellInputClass("text-right text-rose-600 dark:text-rose-400")}
        />
      </td>
      <td className="py-1 pr-1">
        <button
          onClick={onDelete}
          className="h-5 w-5 flex items-center justify-center rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label="Remove food item"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

// ─── Meal table (clean Food | Quantity | Kcal | P | C | F layout) ────────────

const ROW_COLLAPSE_THRESHOLD = 6;

function MealTable({
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
  const isLong = meal.items.length > ROW_COLLAPSE_THRESHOLD;
  // Long meals start collapsed (accordion) to keep the page from getting too tall
  const [expanded, setExpanded] = useState(!isLong);
  const totals = useMemo(() => sumItems(meal.items), [meal.items]);

  const visibleItems = isLong && !expanded ? meal.items.slice(0, ROW_COLLAPSE_THRESHOLD) : meal.items;
  const hiddenCount = meal.items.length - visibleItems.length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-muted/40">
        <span className="text-sm font-semibold shrink-0">{meal.name}</span>
        {meal.items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {Math.round(totals.kcal)} kcal · {meal.items.length} item{meal.items.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {meal.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse table-fixed">
            <thead>
              <tr className="text-[9px] uppercase tracking-wide text-muted-foreground/70">
                {/* Food has no fixed width — it absorbs whatever space is left */}
                <th className="text-left font-semibold pl-3 pr-1 py-1.5">Food</th>
                <th className="w-[54px] text-left font-semibold pr-1 py-1.5">Qty</th>
                <th className="w-9 text-right font-semibold pr-1 py-1.5">Kcal</th>
                <th className="w-7 text-right font-semibold pr-1 py-1.5">P</th>
                <th className="w-7 text-right font-semibold pr-1 py-1.5">C</th>
                <th className="w-7 text-right font-semibold pr-1.5 py-1.5">F</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <FoodRow
                  key={item.id}
                  item={item}
                  onChange={(field, value) => onUpdateItem(item.id, field, value)}
                  onChangeNumber={(field, value) => onUpdateItemNumber(item.id, field, value)}
                  onDelete={() => onDeleteItem(item.id)}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="pl-3 pr-1.5 py-1.5 text-foreground" colSpan={2}>
                  Meal total
                </td>
                <td className="text-right pr-1.5 py-1.5 text-foreground">{Math.round(totals.kcal)}</td>
                <td className="text-right pr-1 py-1.5 text-blue-600 dark:text-blue-400">{Math.round(totals.protein)}</td>
                <td className="text-right pr-1 py-1.5 text-amber-600 dark:text-amber-400">{Math.round(totals.carbs)}</td>
                <td className="text-right pr-2 py-1.5 text-rose-600 dark:text-rose-400">{Math.round(totals.fat)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border">
        {isLong ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {expanded ? "Show less" : `Show ${hiddenCount} more item${hiddenCount !== 1 ? "s" : ""}`}
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={onAddItem}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add food
        </button>
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
        Save Nutrition Plan
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
        No {label.toLowerCase()} nutrition plan yet. Import one below to get started.
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

  const [importOpen, setImportOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<MacroDayType>("vegetarian");
  const [draft, setDraft] = useState<MacroDayPlan | null>(null);
  const [dirty, setDirty] = useState(false);

  // Restore last-used day type
  useEffect(() => {
    const saved = localStorage.getItem(LS_DAY_TYPE_KEY);
    if (DAY_TYPES.some((d) => d.key === saved)) setSelectedType(saved as MacroDayType);
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
    toast.success(`${dayTypeMeta(selectedType).label} nutrition plan saved!`);
  }, [draft, macroPlan, setMacroPlan, selectedType]);

  function dayTypeMeta(key: MacroDayType) {
    return DAY_TYPES.find((d) => d.key === key)!;
  }

  const dayTotals = useMemo(
    () => (draft ? sumItems(draft.meals.flatMap((m) => m.items)) : null),
    [draft]
  );

  const activeMeta = dayTypeMeta(selectedType);

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        {/* Day-type selector */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Select a day type</p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
            {DAY_TYPES.map((dt) => {
              const Icon = dt.icon;
              const hasPlan = macroPlan.dayPlans.some((p) => p.dayType === dt.key);
              return (
                <button
                  key={dt.key}
                  onClick={() => handleTypeChange(dt.key)}
                  className={cn(
                    "flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                    selectedType === dt.key
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
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
        </div>

        {draft && dayTotals ? (
          <>
            {/* Day totals banner */}
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-3.5 py-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Daily total{draft.label ? ` · ${draft.label}` : ` · ${activeMeta.label}`}
              </p>
              <MacroStats totals={dayTotals} size="md" />
            </div>

            {/* Meals */}
            <div className="space-y-3">
              {draft.meals.map((meal) => (
                <MealTable
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
                <p className="text-sm font-semibold">Import Nutrition Plan</p>
                <p className="text-xs text-muted-foreground">Drag & drop a structured nutrition JSON</p>
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
    </Card>
  );
}
