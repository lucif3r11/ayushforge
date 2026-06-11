"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Layers,
  Trash2,
  ChevronDown,
  Target,
  Clock,
  TrendingUp,
  FileJson,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import DetailedBlockImporter from "@/components/train/DetailedBlockImporter";
import type {
  DetailedBlock,
  DetailedBlockDay,
  DetailedExercise,
  DetailedExerciseGroup,
  DetailedBlockSection,
  ProgressionTable,
  WeeklyScheduleItem,
} from "@/lib/types";

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
        {children}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ─── Block header ──────────────────────────────────────────────────────────────

function BlockHeader({ block }: { block: DetailedBlock }) {
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-lg font-bold leading-tight">{block.name}</p>
        {block.period && <p className="text-xs text-muted-foreground mt-0.5">{block.period}</p>}
      </div>
      {block.focus && (
        <div className="flex items-start gap-2">
          <Target className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-foreground/90 leading-snug">{block.focus}</p>
        </div>
      )}
      {block.targets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {block.targets.map((t, i) => (
            <Badge key={i} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Weekly schedule ────────────────────────────────────────────────────────────

function WeeklySchedule({ items }: { items: WeeklyScheduleItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <SectionLabel>Weekly Schedule</SectionLabel>
      <div className="space-y-1">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
          >
            <span className="text-xs font-semibold shrink-0">{it.day}</span>
            <span className="text-xs text-muted-foreground text-right truncate">{it.label || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Global instructions ────────────────────────────────────────────────────────

function GlobalInstructions({ before }: { before: string[] }) {
  if (before.length === 0) return null;
  return (
    <div className="space-y-2">
      <SectionLabel>Before Every Session</SectionLabel>
      <ul className="space-y-1 rounded-lg border border-border px-3 py-2.5">
        {before.map((b, i) => (
          <li key={i} className="text-xs text-muted-foreground flex gap-1.5 leading-snug">
            <span className="text-muted-foreground/40 shrink-0">•</span>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DayAddOns({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
        Day Add-on
      </p>
      <ul className="space-y-0.5">
        {items.map((a, i) => (
          <li key={i} className="text-xs text-amber-700 dark:text-amber-400/90 leading-snug flex gap-1.5">
            <span className="shrink-0">•</span>
            {a}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Exercise row ────────────────────────────────────────────────────────────────

function ExerciseRow({ ex, indexLabel }: { ex: DetailedExercise; indexLabel?: string }) {
  const setsReps = [ex.sets, ex.reps].filter(Boolean).join(" × ");
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {indexLabel && (
            <span className="text-xs font-bold text-primary/60 shrink-0 mt-0.5 w-4">{indexLabel}</span>
          )}
          <p className="text-sm font-medium leading-snug">{ex.name}</p>
        </div>
        <div className="flex flex-col items-end shrink-0 ml-2 text-xs text-muted-foreground gap-0.5">
          {setsReps && <span className="font-semibold text-foreground whitespace-nowrap">{setsReps}</span>}
          {ex.load && <span className="whitespace-nowrap">{ex.load}</span>}
          {ex.rpe && <span className="whitespace-nowrap">RPE {ex.rpe}</span>}
        </div>
      </div>

      {(ex.tempo || ex.rest) && (
        <p className={cn("text-xs text-muted-foreground leading-snug", indexLabel && "pl-6")}>
          {ex.tempo && `Tempo ${ex.tempo}`}
          {ex.tempo && ex.rest && " · "}
          {ex.rest && `Rest ${ex.rest}`}
        </p>
      )}

      {ex.notes && (
        <p className={cn("text-xs text-muted-foreground leading-snug", indexLabel && "pl-6")}>{ex.notes}</p>
      )}

      {ex.formCues && ex.formCues.length > 0 && (
        <ul className={cn("space-y-0.5", indexLabel && "pl-6")}>
          {ex.formCues.map((c, i) => (
            <li key={i} className="text-[11px] text-muted-foreground/80 leading-snug flex gap-1">
              <span className="text-muted-foreground/40 shrink-0">•</span>
              {c}
            </li>
          ))}
        </ul>
      )}

      {ex.loadProgression && (
        <p className={cn("text-[11px] text-primary/70 leading-snug", indexLabel && "pl-6")}>
          ↗ {ex.loadProgression}
        </p>
      )}
    </div>
  );
}

// ─── Exercise group (single or superset) ───────────────────────────────────────

function GroupBlock({ group }: { group: DetailedExerciseGroup }) {
  if (group.isSuperset) {
    return (
      <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 pt-2.5 pb-3 space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-primary/70 shrink-0">
            {group.label ? `Superset ${group.label}` : "Superset"}
          </span>
          {group.groupName && (
            <span className="text-[11px] font-semibold text-foreground/80 truncate">
              {group.groupName}
            </span>
          )}
          <div className="flex-1 h-px bg-primary/15 min-w-2" />
          {group.rounds && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">
              {group.rounds} round{group.rounds === "1" ? "" : "s"}
            </Badge>
          )}
        </div>
        {group.exercises.map((ex, j) => (
          <ExerciseRow key={ex.id} ex={ex} indexLabel={String.fromCharCode(65 + j)} />
        ))}
        {group.restAfterPair && (
          <p className="text-[11px] text-primary/70 leading-snug pt-1 border-t border-primary/10">
            Rest after round: {group.restAfterPair}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="py-1">
      <ExerciseRow ex={group.exercises[0]} />
    </div>
  );
}

// ─── Section block ──────────────────────────────────────────────────────────────

function SectionBlock({ section }: { section: DetailedBlockSection }) {
  return (
    <div className="space-y-2">
      <SectionLabel>{section.name}</SectionLabel>
      <div className="space-y-2">
        {section.groups.map((g) => (
          <GroupBlock key={g.id} group={g} />
        ))}
      </div>
    </div>
  );
}

// ─── Day view ───────────────────────────────────────────────────────────────────

function DayView({ day, addOns }: { day: DetailedBlockDay; addOns: string[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-3.5 py-3 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {day.name}
          {day.label ? ` · ${day.label}` : ""}
        </p>
        {day.estimatedTime && (
          <p className="text-sm flex items-center gap-1.5 text-foreground font-medium">
            <Clock className="h-3.5 w-3.5 text-orange-500" />
            ~{day.estimatedTime}
          </p>
        )}
      </div>

      <DayAddOns items={addOns} />

      <div className="space-y-4">
        {day.sections.map((s) => (
          <SectionBlock key={s.id} section={s} />
        ))}
      </div>
    </div>
  );
}

// ─── Progression table ──────────────────────────────────────────────────────────

function ProgressionTableCard({ table }: { table: ProgressionTable }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">{table.lift}</span>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {table.rows.length} week{table.rows.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-[9px] uppercase tracking-wide text-muted-foreground/70">
                <th className="text-left font-semibold pl-3 pr-1 py-1.5">Week</th>
                <th className="text-left font-semibold pr-1 py-1.5">Load</th>
                <th className="text-left font-semibold pr-1 py-1.5">Sets</th>
                <th className="text-left font-semibold pr-1 py-1.5">Reps</th>
                <th className="text-left font-semibold pr-1 py-1.5">RPE</th>
                <th className="text-left font-semibold pr-3 py-1.5">Notes</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-border/60">
                  <td className="py-1.5 pl-3 pr-1 font-medium whitespace-nowrap">{r.week}</td>
                  <td className="py-1.5 pr-1 whitespace-nowrap">{r.load ?? "—"}</td>
                  <td className="py-1.5 pr-1 whitespace-nowrap">{r.sets ?? "—"}</td>
                  <td className="py-1.5 pr-1 whitespace-nowrap">{r.reps ?? "—"}</td>
                  <td className="py-1.5 pr-1 whitespace-nowrap">{r.rpe ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{r.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────────

function EmptyBlocks() {
  return (
    <div className="rounded-xl border border-dashed border-border py-8 flex flex-col items-center gap-2 text-center px-4">
      <Layers className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.25} />
      <p className="text-xs text-muted-foreground">
        No detailed blocks yet. Import one below to get started.
      </p>
    </div>
  );
}

// ─── Day add-on lookup helper ────────────────────────────────────────────────────

function getDayAddOns(block: DetailedBlock, day: DetailedBlockDay, dayIndex: number): string[] {
  const candidates = [day.name, day.label, block.weeklySchedule[dayIndex]?.day].filter(
    (x): x is string => !!x
  );
  for (const candidate of candidates) {
    const entry = Object.entries(block.dayAddOns).find(
      ([key]) => key.toLowerCase().trim() === candidate.toLowerCase().trim()
    );
    if (entry) return entry[1];
  }
  return [];
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DetailedBlockView() {
  const detailedBlocks = useAppStore((s) => s.detailedBlocks);
  const deleteDetailedBlock = useAppStore((s) => s.deleteDetailedBlock);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Default to the most-recently-imported block
  useEffect(() => {
    if (detailedBlocks.length === 0) {
      setSelectedBlockId(null);
      return;
    }
    if (!selectedBlockId || !detailedBlocks.some((b) => b.id === selectedBlockId)) {
      setSelectedBlockId(detailedBlocks[detailedBlocks.length - 1].id);
    }
  }, [detailedBlocks, selectedBlockId]);

  const block = useMemo(
    () => detailedBlocks.find((b) => b.id === selectedBlockId) ?? null,
    [detailedBlocks, selectedBlockId]
  );

  // Default to the first day whenever the selected block changes
  useEffect(() => {
    if (!block) {
      setSelectedDayId(null);
      return;
    }
    if (!selectedDayId || !block.days.some((d) => d.id === selectedDayId)) {
      setSelectedDayId(block.days[0]?.id ?? null);
    }
  }, [block, selectedDayId]);

  const dayIndex = useMemo(
    () => (block && selectedDayId ? block.days.findIndex((d) => d.id === selectedDayId) : -1),
    [block, selectedDayId]
  );
  const day = dayIndex >= 0 && block ? block.days[dayIndex] : null;
  const addOns = block && day ? getDayAddOns(block, day, dayIndex) : [];

  const handleDelete = useCallback(
    (id: string, name: string) => {
      deleteDetailedBlock(id);
      toast.success(`"${name}" removed.`);
    },
    [deleteDetailedBlock]
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        {detailedBlocks.length === 0 ? (
          <EmptyBlocks />
        ) : (
          <>
            {/* Block selector */}
            {detailedBlocks.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
                {detailedBlocks.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelectedBlockId(b.id);
                      setSelectedDayId(null);
                    }}
                    className={cn(
                      "flex-shrink-0 px-3 py-2 rounded-lg border text-xs font-medium transition-all max-w-[180px] truncate",
                      b.id === selectedBlockId
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}

            {block && (
              <>
                <BlockHeader block={block} />
                <WeeklySchedule items={block.weeklySchedule} />
                <GlobalInstructions before={block.beforeEverySession} />

                {/* Day tabs */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Select a day</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
                    {block.days.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDayId(d.id)}
                        className={cn(
                          "flex-shrink-0 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                          d.id === selectedDayId
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                        )}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>

                {day && <DayView day={day} addOns={addOns} />}

                {block.progressionTables.length > 0 && (
                  <div className="space-y-2">
                    <SectionLabel>Progression</SectionLabel>
                    <div className="space-y-2">
                      {block.progressionTables.map((t) => (
                        <ProgressionTableCard key={t.id} table={t} />
                      ))}
                    </div>
                  </div>
                )}

                <Separator />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(block.id, block.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove Block
                  </Button>
                </div>
              </>
            )}
          </>
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
                <p className="text-sm font-semibold">Import Detailed Block</p>
                <p className="text-xs text-muted-foreground">Drag & drop a detailed_block JSON</p>
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
                <DetailedBlockImporter />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
