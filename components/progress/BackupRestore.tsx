"use client";

import { useRef, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import {
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  RefreshCcw,
  FileDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { BackupFile, AppData } from "@/lib/types";

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidBackup(obj: unknown): obj is BackupFile {
  if (!obj || typeof obj !== "object") return false;
  const b = obj as Record<string, unknown>;
  if (typeof b.version !== "number") return false;
  if (b.appName !== "Ironclad") return false;
  if (!b.data || typeof b.data !== "object") return false;
  const d = b.data as Record<string, unknown>;
  // Require at least the blocks array to be present
  if (!Array.isArray(d.blocks)) return false;
  return true;
}

// ─── Summary of a backup's contents ──────────────────────────────────────────

function BackupSummary({
  data,
}: {
  data: BackupFile["data"];
}) {
  const items = [
    { label: "Blocks",       count: data.blocks?.length       ?? 0 },
    { label: "Workouts",     count: data.workoutLogs?.length  ?? 0 },
    { label: "Exercises",    count: data.exercises?.length    ?? 0 },
    { label: "Body entries", count: data.bodyEntries?.length  ?? 0 },
    { label: "Routines",     count: data.routines?.length     ?? 0 },
  ].filter((i) => i.count > 0);

  return (
    <div className="text-xs text-muted-foreground space-y-1">
      <p className="font-medium text-foreground">This backup contains:</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.length === 0 ? (
          <span>No data</span>
        ) : (
          items.map((i) => (
            <span key={i.label}>
              <span className="font-semibold text-foreground">{i.count}</span>{" "}
              {i.label}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Confirmation card ────────────────────────────────────────────────────────

function ConfirmImport({
  backup,
  onConfirm,
  onCancel,
}: {
  backup: BackupFile;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">Replace all current data?</p>
          <p className="text-xs text-muted-foreground">
            This will permanently overwrite everything in the app. This cannot
            be undone.
          </p>
        </div>
      </div>

      <Separator className="border-amber-500/20" />

      <BackupSummary data={backup.data} />

      <p className="text-xs text-muted-foreground">
        Exported{" "}
        {format(parseISO(backup.exportedAt), "MMM d, yyyy 'at' h:mm a")}
      </p>

      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white border-0"
          onClick={onConfirm}
        >
          Yes, Import
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BackupRestore() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [importing, setImporting] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Store selectors
  const blocks        = useAppStore((s) => s.blocks);
  const exercises     = useAppStore((s) => s.exercises);
  const routines      = useAppStore((s) => s.routines);
  const workoutLogs   = useAppStore((s) => s.workoutLogs);
  const dietSupps     = useAppStore((s) => s.dietSupps);
  const bodyEntries   = useAppStore((s) => s.bodyEntries);
  const nutritionPlan = useAppStore((s) => s.nutritionPlan);
  const macroPlan     = useAppStore((s) => s.macroPlan);
  const detailedBlocks = useAppStore((s) => s.detailedBlocks);
  const lastExportedAt = useAppStore((s) => s.lastExportedAt);
  const importAllData  = useAppStore((s) => s.importAllData);
  const setLastExportedAt = useAppStore((s) => s.setLastExportedAt);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const exportedAt = new Date().toISOString();

    const backup: BackupFile = {
      version: 1,
      appName: "Ironclad",
      exportedAt,
      data: {
        blocks,
        exercises,
        routines,
        workoutLogs,
        dietSupps,
        bodyEntries,
        nutritionPlan,
        macroPlan,
        detailedBlocks,
      },
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const dateStr = format(new Date(), "yyyy-MM-dd");
    const a = document.createElement("a");
    a.href = url;
    a.download = `ironclad-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setLastExportedAt(exportedAt);
    toast.success("Backup downloaded!", {
      description: `ironclad-backup-${dateStr}.json`,
    });
  }, [blocks, exercises, routines, workoutLogs, dietSupps, bodyEntries, nutritionPlan, macroPlan, setLastExportedAt]);

  // ── Import ────────────────────────────────────────────────────────────────

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset so the same file can be re-selected after cancel
      e.target.value = "";
      if (!file) return;

      try {
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);

        if (!isValidBackup(parsed)) {
          toast.error("Invalid backup file.", {
            description: "Make sure you're importing an Ironclad backup.",
          });
          return;
        }

        setPendingBackup(parsed);
      } catch {
        toast.error("Could not read the file.", {
          description: "Make sure it's a valid JSON file.",
        });
      }
    },
    []
  );

  const confirmImport = useCallback(() => {
    if (!pendingBackup) return;
    setImporting(true);

    try {
      importAllData(pendingBackup.data as Omit<AppData, "lastUpdated" | "lastExportedAt">);
      setPendingBackup(null);
      toast.success("Data imported successfully!", {
        description: "Your app data has been restored from backup.",
      });
    } catch {
      toast.error("Import failed. The backup may be corrupted.");
    } finally {
      setImporting(false);
    }
  }, [pendingBackup, importAllData]);

  const cancelImport = useCallback(() => {
    setPendingBackup(null);
  }, []);

  const handlePdfExport = useCallback(async () => {
    if (bodyEntries.length === 0) {
      toast.error("No body entries to export.", {
        description: "Add measurements first.",
      });
      return;
    }
    setLoadingPdf(true);
    try {
      const { generateBmiReportPDF } = await import("@/lib/pdf");
      await generateBmiReportPDF(bodyEntries);
      toast.success("BMI report downloaded!");
    } catch {
      toast.error("Could not generate PDF.");
    } finally {
      setLoadingPdf(false);
    }
  }, [bodyEntries]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-muted p-1.5 shrink-0">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base">Backup & Restore</CardTitle>
            <CardDescription className="text-xs">
              {lastExportedAt
                ? `Last backup: ${format(parseISO(lastExportedAt), "MMM d, yyyy 'at' h:mm a")}`
                : "Keep your data safe — export a backup anytime"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Confirmation card — shown while user is reviewing an import */}
        {pendingBackup ? (
          <ConfirmImport
            backup={pendingBackup}
            onConfirm={confirmImport}
            onCancel={cancelImport}
          />
        ) : (
          <div className="space-y-3">
            {/* Export */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
              <Download className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-sm font-medium">Export Data</p>
                  <p className="text-xs text-muted-foreground">
                    Downloads a JSON backup of all your data — blocks, workouts,
                    body entries, nutrition plan, and more.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleExport}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export JSON
                </Button>
              </div>
            </div>

            <Separator />

            {/* PDF export */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
              <FileDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-sm font-medium">BMI Progress Report</p>
                  <p className="text-xs text-muted-foreground">
                    Download a printable PDF with your current metrics,
                    progress summary and full measurement history.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={loadingPdf || bodyEntries.length === 0}
                  onClick={handlePdfExport}
                >
                  {loadingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  {loadingPdf ? "Generating…" : "Export PDF"}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Import */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
              <Upload className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-sm font-medium">Import Data</p>
                  <p className="text-xs text-muted-foreground">
                    Restore from a previous backup. This will{" "}
                    <span className="font-semibold text-amber-500">
                      replace all current data
                    </span>
                    .
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={importing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {importing ? (
                    <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {importing ? "Importing…" : "Import JSON"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
      </CardContent>
    </Card>
  );
}
