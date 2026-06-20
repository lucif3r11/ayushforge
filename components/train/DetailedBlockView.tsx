"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

// ─── Motion presets ────────────────────────────────────────────────────────────

const daySlideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 56 : -56,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      type: "tween" as const,
      duration: 0.38,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
    transition: {
      type: "tween" as const,
      duration: 0.22,
      ease: [0.4, 0, 0.8, 0.2] as [number, number, number, number],
    },
  }),
};

// ─── Section accent (target-lock chroma) ───────────────────────────────────────

type SectionAccent = {
  bar: string;
  glow?: string;
};

function resolveSectionAccent(section: DetailedBlockSection): SectionAccent {
  const raw = `${section.type ?? ""} ${section.name}`.toLowerCase();

  if (/heavy.?compound|^compounds?$/.test(raw) && !/superset/.test(raw)) {
    return {
      bar: "bg-cyber",
      glow: "shadow-[0_0_10px_hsl(186_100%_50%/0.55)]",
    };
  }
  if (/finisher|hyrox/.test(raw)) {
    return {
      bar: "bg-toxic",
      glow: "shadow-[0_0_10px_hsl(108_100%_54%/0.55)]",
    };
  }
  if (/superset/.test(raw)) {
    return {
      bar: "bg-cyber/70",
      glow: "shadow-[0_0_8px_hsl(186_100%_50%/0.35)]",
    };
  }
  if (/warm/.test(raw)) {
    return { bar: "bg-zinc-500/60" };
  }
  if (/unilateral/.test(raw)) {
    return {
      bar: "bg-amber-400",
      glow: "shadow-[0_0_8px_hsl(38_92%_52%/0.45)]",
    };
  }
  if (/core/.test(raw)) {
    return {
      bar: "bg-violet-400",
      glow: "shadow-[0_0_8px_hsl(267_60%_62%/0.45)]",
    };
  }
  if (/accessor/.test(raw)) {
    return { bar: "bg-zinc-400/70" };
  }
  if (/cool/.test(raw)) {
    return { bar: "bg-zinc-600/60" };
  }
  return { bar: "bg-border" };
}

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
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left"
        aria-expanded={expanded}
      >
        <span className="text-sm font-semibold">
          {expanded ? "Hide Weekly Schedule" : "Show Weekly Schedule"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <div className="border-t border-border px-3.5 py-2.5 space-y-1">
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
      )}
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

function exerciseSetsRepsLabel(ex: DetailedExercise): string | undefined {
  const combined = ex.setsReps?.trim();
  if (combined) return combined;
  const built = [ex.sets, ex.reps].filter(Boolean).join(" × ");
  return built || undefined;
}

function NoteBlock({ children, indent }: { children: React.ReactNode; indent?: boolean }) {
  return (
    <div className={cn("flex gap-2 mt-1", indent && "pl-6")}>
      <div className="w-px bg-border/70 shrink-0 self-stretch min-h-[1em]" aria-hidden />
      <div className="min-w-0 text-xs text-muted-foreground leading-snug">{children}</div>
    </div>
  );
}

function ExerciseRow({
  ex,
  indexLabel,
  accent,
}: {
  ex: DetailedExercise;
  indexLabel?: string;
  accent: SectionAccent;
}) {
  const setsReps = exerciseSetsRepsLabel(ex);
  const metaLine = [
    ex.tempo ? `Tempo ${ex.tempo}` : null,
    ex.rpe ? `RPE ${ex.rpe}` : null,
    ex.load ? `Load ${ex.load}` : null,
    ex.loadProgression ? `↗ ${ex.loadProgression}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const detailIndent = indexLabel ? "pl-6" : "pl-0.5";

  return (
    <div className="relative pl-3">
      <div
        className={cn(
          "absolute left-0 top-0.5 bottom-0.5 w-[2px] rounded-full",
          accent.bar,
          accent.glow
        )}
        aria-hidden
      />

      <div className="space-y-0.5 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {indexLabel && (
            <span className="flex items-center justify-center h-4 w-4 rounded-full bg-primary/15 text-[10px] font-bold text-primary shrink-0">
              {indexLabel}
            </span>
          )}
          <p className="text-sm font-semibold leading-snug tracking-tight">{ex.name}</p>
          {setsReps && (
            <span className="shrink-0 rounded border border-cyber/20 bg-cyber/8 px-1.5 py-px text-[11px] font-bold font-mono tabular-nums text-cyber/90 shadow-[0_0_8px_hsl(186_100%_50%/0.12)]">
              {setsReps}
            </span>
          )}
        </div>

        {metaLine && (
          <p className={cn("text-[10px] font-mono text-muted-foreground leading-snug", detailIndent)}>
            {metaLine}
          </p>
        )}

        {ex.rest && (
          <p className={cn("text-[10px] font-mono text-muted-foreground/80 leading-snug", detailIndent)}>
            Rest {ex.rest}
          </p>
        )}

        {ex.notes && <NoteBlock indent={!!indexLabel}>{ex.notes}</NoteBlock>}

        {ex.formCues && ex.formCues.length > 0 && (
          <NoteBlock indent={!!indexLabel}>
            <ul className="space-y-0.5">
              {ex.formCues.map((c, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-muted-foreground/50 shrink-0">•</span>
                  {c}
                </li>
              ))}
            </ul>
          </NoteBlock>
        )}
      </div>
    </div>
  );
}

// ─── Exercise group (single or superset) ───────────────────────────────────────

function supersetGroupTitle(group: DetailedExerciseGroup): string {
  if (group.groupName) return group.groupName;
  if (group.label) return `SUPERSET ${group.label}`;
  return "SUPERSET";
}

function GroupBlock({
  group,
  forceSuperset = false,
  accent,
}: {
  group: DetailedExerciseGroup;
  forceSuperset?: boolean;
  accent: SectionAccent;
}) {
  const showAsSuperset = forceSuperset || group.isSuperset;

  if (showAsSuperset) {
    return (
      <div
        className={cn(
          "rounded-sm backdrop-blur-md bg-card/60 px-3 py-2.5 space-y-2",
          "border border-cyber/20",
          "shadow-[0_0_0_1px_hsl(186_100%_50%/0.12),inset_0_0_24px_hsl(186_100%_50%/0.03),0_0_28px_hsl(186_100%_50%/0.07)]"
        )}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-cyber/80 shrink-0">
            {supersetGroupTitle(group)}
          </span>
          <div className="flex-1 h-px bg-cyber/15 min-w-2 shadow-[0_0_6px_hsl(186_100%_50%/0.25)]" />
          {group.rounds && (
            <Badge
              variant="secondary"
              className="text-[9px] h-4 px-1.5 shrink-0 font-mono border border-cyber/15 bg-cyber/5 text-cyber/90"
            >
              {group.rounds} round{group.rounds === "1" ? "" : "s"}
            </Badge>
          )}
        </div>

        <div className="space-y-2.5">
          {group.exercises.map((ex, j) => (
            <ExerciseRow
              key={ex.id}
              ex={ex}
              indexLabel={String.fromCharCode(65 + j)}
              accent={accent}
            />
          ))}
        </div>

        {group.restAfterPair && (
          <p className="text-[10px] font-mono text-cyber/60 leading-snug pt-1 border-t border-cyber/10">
            Rest after round: {group.restAfterPair}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="py-0.5">
      <ExerciseRow ex={group.exercises[0]} accent={accent} />
    </div>
  );
}

// ─── Section block ──────────────────────────────────────────────────────────────

function isSupersetSection(section: DetailedBlockSection): boolean {
  const t = section.type?.toLowerCase();
  if (t && (t === "supersetgroup" || t === "supersetgroups" || t === "supersets")) return true;
  return !!(section.supersetGroups && section.supersetGroups.length > 0);
}

function sectionGroups(section: DetailedBlockSection): DetailedExerciseGroup[] {
  if (isSupersetSection(section) && section.supersetGroups && section.supersetGroups.length > 0) {
    return section.supersetGroups;
  }
  // Backward compatibility: older imports stored superset data in `groups`
  return section.groups;
}

function SectionBlock({ section }: { section: DetailedBlockSection }) {
  const groups = sectionGroups(section);
  const supersetSection = isSupersetSection(section);
  const accent = resolveSectionAccent(section);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-2">
      <SectionLabel>{section.name}</SectionLabel>
      <div className="space-y-2">
        {groups.map((g) => (
          <GroupBlock key={g.id} group={g} forceSuperset={supersetSection} accent={accent} />
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

interface DetailedBlockViewProps {
  selectedBlockId: string | null;
  selectedDayId: string | null;
  onSelectBlock: (blockId: string) => void;
  onSelectDay: (dayId: string) => void;
}

export default function DetailedBlockView({
  selectedBlockId,
  selectedDayId,
  onSelectBlock,
  onSelectDay,
}: DetailedBlockViewProps) {
  const detailedBlocks = useAppStore((s) => s.detailedBlocks);
  const deleteDetailedBlock = useAppStore((s) => s.deleteDetailedBlock);

  const [importOpen, setImportOpen] = useState(false);
  const [dayDirection, setDayDirection] = useState(1);

  const block = useMemo(
    () => detailedBlocks.find((b) => b.id === selectedBlockId) ?? null,
    [detailedBlocks, selectedBlockId]
  );

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

  const handleSelectDay = useCallback(
    (dayId: string) => {
      if (block) {
        const newIndex = block.days.findIndex((d) => d.id === dayId);
        if (newIndex >= 0 && dayIndex >= 0 && newIndex !== dayIndex) {
          setDayDirection(newIndex > dayIndex ? 1 : -1);
        }
      }
      onSelectDay(dayId);
    },
    [block, dayIndex, onSelectDay]
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
                    onClick={() => onSelectBlock(b.id)}
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                    Target Lock — Select Day
                  </p>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
                    {block.days.map((d) => {
                      const isActive = d.id === selectedDayId;
                      return (
                        <button
                          key={d.id}
                          onClick={() => handleSelectDay(d.id)}
                          className={cn(
                            "relative flex-shrink-0 px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wide transition-colors",
                            isActive
                              ? "border-transparent text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-cyber/30 hover:bg-cyber/5 hover:text-foreground"
                          )}
                        >
                          {isActive && (
                            <motion.span
                              layoutId="detailed-block-day-tab"
                              className="absolute inset-0 rounded-lg border border-primary bg-primary shadow-[0_0_14px_hsl(186_100%_50%/0.35)]"
                              transition={{ type: "spring", stiffness: 420, damping: 32 }}
                            />
                          )}
                          <span className="relative z-10">{d.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <AnimatePresence mode="wait" custom={dayDirection}>
                  {day && (
                    <motion.div
                      key={day.id}
                      custom={dayDirection}
                      variants={daySlideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                    >
                      <DayView day={day} addOns={addOns} />
                    </motion.div>
                  )}
                </AnimatePresence>

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
