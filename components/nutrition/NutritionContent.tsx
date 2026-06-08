"use client";

import { useState, useEffect, useCallback } from "react";
import {
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
import NutritionImporter from "@/components/nutrition/NutritionImporter";
import MacroPlanContent from "@/components/nutrition/MacroPlanContent";
import type { NutritionSupplement } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptySupp(): NutritionSupplement {
  return { id: uid(), name: "", dose: "", timing: "", notes: "" };
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

export default function NutritionContent() {
  const [mounted, setMounted] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [suppsExpanded, setSuppsExpanded] = useState(true);

  const nutritionPlan = useAppStore((s) => s.nutritionPlan);
  const planUpdatedAt = useAppStore((s) => s.nutritionPlan.updatedAt);
  const setNutritionPlan = useAppStore((s) => s.setNutritionPlan);
  const activeBlock = useAppStore((s) => s.blocks.find((b) => b.isActive));

  const [supplements, setSupplements] = useState<NutritionSupplement[]>([]);
  const [suppDirty, setSuppDirty] = useState(false);

  // Hydrate / re-sync whenever the store plan changes
  useEffect(() => {
    const plan = useAppStore.getState().nutritionPlan;
    setSupplements(plan.supplements.map((s) => ({ ...s })));
    setSuppDirty(false);
    if (!mounted) setMounted(true);
  }, [planUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const namedSupps = supplements.filter((s) => s.name.trim().length > 0).length;

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
          STRUCTURED NUTRITION TABLES (calories & macros per meal)
      ══════════════════════════════════════════════ */}
      <MacroPlanContent />

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
