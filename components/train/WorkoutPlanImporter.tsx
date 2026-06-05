"use client";

import { useState, useCallback, useRef, DragEvent } from "react";
import {
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkoutImportBlock, ConflictStrategy } from "@/lib/types";

// ─── File parsing ─────────────────────────────────────────────────────────────

function normalizeExercises(rawExs: unknown[]) {
  return rawExs
    .map((e, idx) => {
      const ex = e as Record<string, unknown>;
      return {
        exerciseName: String(ex.exerciseName ?? ex.name ?? "").trim(),
        targetSets: Number(ex.targetSets ?? 3),
        targetReps: String(ex.targetReps ?? "8-12"),
        targetWeight: ex.targetWeight != null ? Number(ex.targetWeight) : undefined,
        restSeconds: ex.restSeconds != null ? Number(ex.restSeconds) : undefined,
        notes: ex.notes ? String(ex.notes) : undefined,
        order: Number(ex.order ?? idx),
        supersetGroup: ex.supersetGroup ? String(ex.supersetGroup) : undefined,
        tempo: ex.tempo ? String(ex.tempo) : undefined,
        progressionScheme: ex.progressionScheme ? String(ex.progressionScheme) : undefined,
      };
    })
    .filter((e) => e.exerciseName.length > 0);
}

function normalizeRoutines(rawRoutines: unknown[]) {
  return rawRoutines.map((r) => {
    const rt = r as Record<string, unknown>;
    return {
      name: String(rt.name ?? "Unnamed Routine"),
      description: rt.description ? String(rt.description) : undefined,
      exercises: Array.isArray(rt.exercises) ? normalizeExercises(rt.exercises) : [],
    };
  });
}

function normalizeBlocks(rawBlocks: unknown[]): WorkoutImportBlock[] {
  return (rawBlocks as Record<string, unknown>[])
    .map((b) => ({
      name: String(b.name ?? "").trim(),
      goal: String(b.goal ?? ""),
      startDate: b.startDate ? String(b.startDate) : undefined,
      endDate: b.endDate ? String(b.endDate) : undefined,
      notes: b.notes ? String(b.notes) : undefined,
      routines: Array.isArray(b.routines) ? normalizeRoutines(b.routines) : [],
    }))
    .filter((b) => b.name.length > 0);
}

function extractFromBackup(rawBlocks: unknown[], rawRoutines: unknown[]): WorkoutImportBlock[] {
  const routineMap = new Map<string, Record<string, unknown>>();
  for (const r of rawRoutines) {
    const rt = r as Record<string, unknown>;
    if (rt.id) routineMap.set(String(rt.id), rt);
  }
  return normalizeBlocks(
    (rawBlocks as Record<string, unknown>[]).map((block) => ({
      ...block,
      routines: Array.isArray(block.routineIds)
        ? (block.routineIds as string[])
            .map((rid) => routineMap.get(rid))
            .filter(Boolean)
        : [],
    }))
  );
}

function parsePlanFile(raw: unknown): WorkoutImportBlock[] | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // Ironclad full backup
  if (obj.appName === "Ironclad" && obj.data && typeof obj.data === "object") {
    const d = obj.data as Record<string, unknown>;
    if (Array.isArray(d.blocks) && Array.isArray(d.routines)) {
      return extractFromBackup(d.blocks, d.routines);
    }
  }

  // Claude-generated format: { type: "workout_only", block: {...}, routines: [...] }
  if (obj.type === "workout_only" && obj.block && typeof obj.block === "object") {
    const b = obj.block as Record<string, unknown>;
    return normalizeBlocks([
      {
        ...b,
        routines: Array.isArray(obj.routines) ? obj.routines : [],
      },
    ]);
  }

  // Native { type: "workout-plan", blocks: [...] }
  if (obj.type === "workout-plan" && Array.isArray(obj.blocks)) {
    return normalizeBlocks(obj.blocks);
  }

  // Relaxed { blocks: [...] }
  if (Array.isArray(obj.blocks)) {
    return normalizeBlocks(obj.blocks);
  }

  return null;
}

// ─── Block preview card ───────────────────────────────────────────────────────

function BlockPreviewCard({
  block,
  conflict,
  strategy,
  onStrategyChange,
}: {
  block: WorkoutImportBlock;
  conflict: boolean;
  strategy: ConflictStrategy;
  onStrategyChange: (s: ConflictStrategy) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalEx = block.routines.reduce((acc, r) => acc + r.exercises.length, 0);

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        conflict ? "border-amber-500/50 bg-amber-500/5" : "border-border bg-muted/20"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold">{block.name}</span>
            {conflict && (
              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-0 text-[10px] h-4 px-1.5">
                Exists
              </Badge>
            )}
          </div>
          {block.goal && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{block.goal}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Badge variant="secondary" className="text-xs">{block.routines.length}R</Badge>
          <Badge variant="secondary" className="text-xs">{totalEx}E</Badge>
        </div>
      </div>

      {/* Conflict resolution buttons */}
      {conflict && (
        <div className="flex gap-2">
          <button
            onClick={() => onStrategyChange("merge")}
            className={cn(
              "flex-1 text-xs py-1.5 px-2 rounded-lg border transition-colors font-medium",
              strategy === "merge"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            + Merge routines
          </button>
          <button
            onClick={() => onStrategyChange("replace")}
            className={cn(
              "flex-1 text-xs py-1.5 px-2 rounded-lg border transition-colors font-medium",
              strategy === "replace"
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            ↺ Replace block
          </button>
        </div>
      )}

      {/* Expandable routine list */}
      {block.routines.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {expanded ? "Hide" : "Show"} routines
          </button>

          {expanded && (
            <div className="space-y-0.5 pl-3 border-l-2 border-border">
              {block.routines.map((r) => (
                <div key={r.name} className="text-xs py-0.5">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">
                    {" "}· {r.exercises.length} exercise{r.exercises.length !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Step = "idle" | "preview" | "success";

interface ImportResult {
  blocksAdded: number;
  blocksUpdated: number;
  routinesAdded: number;
}

export default function WorkoutPlanImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [importing, setImporting] = useState(false);
  const [parsedBlocks, setParsedBlocks] = useState<WorkoutImportBlock[]>([]);
  const [conflictChoices, setConflictChoices] = useState<Record<string, ConflictStrategy>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  const existingBlocks = useAppStore((s) => s.blocks);
  const importWorkoutPlanData = useAppStore((s) => s.importWorkoutPlanData);

  const existingNames = new Set(existingBlocks.map((b) => b.name.toLowerCase()));

  // ── File processing ───────────────────────────────────────────────────────

  const processFile = useCallback(
    (file: File) => {
      file.text().then((text) => {
        try {
          const raw = JSON.parse(text);
          const blocks = parsePlanFile(raw);

          if (!blocks || blocks.length === 0) {
            toast.error("No workout blocks found.", {
              description: "The file must contain blocks with routines.",
            });
            return;
          }

          const choices: Record<string, ConflictStrategy> = {};
          for (const block of blocks) {
            if (existingNames.has(block.name.toLowerCase())) {
              choices[block.name] = "merge";
            }
          }

          setParsedBlocks(blocks);
          setConflictChoices(choices);
          setStep("preview");
        } catch {
          toast.error("Could not parse the file.", {
            description: "Make sure it's a valid JSON file.",
          });
        }
      });
    },
    [existingNames] // eslint-disable-line react-hooks/exhaustive-deps
  );

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

  // ── Import confirm ────────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    if (parsedBlocks.length === 0) return;
    setImporting(true);
    try {
      const res = importWorkoutPlanData(parsedBlocks, conflictChoices);
      setResult(res);
      setStep("success");
      toast.success("Workout plan imported!", {
        description: `${res.blocksAdded + res.blocksUpdated} block${res.blocksAdded + res.blocksUpdated !== 1 ? "s" : ""}, ${res.routinesAdded} routine${res.routinesAdded !== 1 ? "s" : ""}.`,
      });
    } catch {
      toast.error("Import failed. The file may be malformed.");
    } finally {
      setImporting(false);
    }
  }, [parsedBlocks, conflictChoices, importWorkoutPlanData]);

  const handleReset = useCallback(() => {
    setParsedBlocks([]);
    setConflictChoices({});
    setResult(null);
    setStep("idle");
  }, []);

  const handleStrategyChange = useCallback((blockName: string, strategy: ConflictStrategy) => {
    setConflictChoices((prev) => ({ ...prev, [blockName]: strategy }));
  }, []);

  const conflicts = parsedBlocks.filter((b) => existingNames.has(b.name.toLowerCase()));
  const totalRoutines = parsedBlocks.reduce((acc, b) => acc + b.routines.length, 0);

  // ── Success ───────────────────────────────────────────────────────────────

  if (step === "success" && result) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              Plan imported!
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {result.blocksAdded > 0 && `${result.blocksAdded} block${result.blocksAdded !== 1 ? "s" : ""} added`}
              {result.blocksAdded > 0 && result.blocksUpdated > 0 && " · "}
              {result.blocksUpdated > 0 && `${result.blocksUpdated} block${result.blocksUpdated !== 1 ? "s" : ""} updated`}
              {result.routinesAdded > 0 && ` · ${result.routinesAdded} routine${result.routinesAdded !== 1 ? "s" : ""} added`}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={handleReset}>
          Import Another Plan
        </Button>
      </div>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  if (step === "preview") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Ready to import</p>
            <p className="text-xs text-muted-foreground">
              {parsedBlocks.length} block{parsedBlocks.length !== 1 ? "s" : ""} · {totalRoutines} routine{totalRoutines !== 1 ? "s" : ""}
              {conflicts.length > 0 && ` · `}
              {conflicts.length > 0 && (
                <span className="text-amber-500 font-medium">
                  {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {conflicts.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {conflicts.length} block{conflicts.length !== 1 ? "s" : ""} already exist. Choose merge or replace for each.
            </p>
          </div>
        )}

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {parsedBlocks.map((block) => (
            <BlockPreviewCard
              key={block.name}
              block={block}
              conflict={existingNames.has(block.name.toLowerCase())}
              strategy={conflictChoices[block.name] ?? "merge"}
              onStrategyChange={(s) => handleStrategyChange(block.name, s)}
            />
          ))}
        </div>

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
            {dragOver ? "Drop to import" : "Drop workout plan here"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">or click to select a .json file</p>
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
        Accepts Ironclad backups or{" "}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">workout-plan</code> JSON.
      </p>
    </div>
  );
}
