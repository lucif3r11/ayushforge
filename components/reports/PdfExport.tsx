"use client";

import { useState } from "react";
import { FileDown, Loader2, Layers, Scale } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// ─── Individual export card ───────────────────────────────────────────────────

function ExportCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  disabled,
  disabledReason,
  loading,
  onExport,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  buttonLabel: string;
  disabled: boolean;
  disabledReason?: string;
  loading: boolean;
  onExport: () => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
      <div className="rounded-lg bg-background border border-border p-2 shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground leading-snug">
            {disabled && disabledReason ? disabledReason : description}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={disabled || loading}
          onClick={onExport}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileDown className="h-3.5 w-3.5" />
          )}
          {loading ? "Generating…" : buttonLabel}
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PdfExport() {
  const [loadingBlock, setLoadingBlock] = useState(false);
  const [loadingBmi,   setLoadingBmi]   = useState(false);

  const blocks      = useAppStore((s) => s.blocks);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const routines    = useAppStore((s) => s.routines);
  const bodyEntries = useAppStore((s) => s.bodyEntries);

  const activeBlock = blocks.find((b) => b.isActive) ?? (blocks.length > 0 ? blocks[0] : null);

  // ── Block report ──────────────────────────────────────────────────────────

  const handleBlockReport = async () => {
    if (!activeBlock) {
      toast.error("No block available to export.");
      return;
    }
    setLoadingBlock(true);
    try {
      const { generateBlockReportPDF } = await import("@/lib/pdf");
      await generateBlockReportPDF(activeBlock, workoutLogs, routines);
      toast.success("Block report downloaded!", {
        description: `${activeBlock.name} · PDF`,
      });
    } catch (err) {
      console.error(err);
      toast.error("Could not generate the report.");
    } finally {
      setLoadingBlock(false);
    }
  };

  // ── BMI report ────────────────────────────────────────────────────────────

  const handleBmiReport = async () => {
    if (bodyEntries.length === 0) {
      toast.error("No body entries to export.", {
        description: "Add measurements in the Progress tab first.",
      });
      return;
    }
    setLoadingBmi(true);
    try {
      const { generateBmiReportPDF } = await import("@/lib/pdf");
      await generateBmiReportPDF(bodyEntries);
      toast.success("BMI report downloaded!", {
        description: `${bodyEntries.length} entr${bodyEntries.length !== 1 ? "ies" : "y"} · PDF`,
      });
    } catch (err) {
      console.error(err);
      toast.error("Could not generate the report.");
    } finally {
      setLoadingBmi(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-muted p-1.5 shrink-0">
            <FileDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base">Export as PDF</CardTitle>
            <CardDescription className="text-xs">
              Download printable reports for your records
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <ExportCard
          icon={Layers}
          title="Block Report"
          description={
            activeBlock
              ? `Block: ${activeBlock.name} · includes workout sessions, top exercises and summary stats`
              : "Includes block info, workout sessions, top exercises and summary stats"
          }
          buttonLabel="Export Block PDF"
          disabled={!activeBlock}
          disabledReason="Create and activate a training block to export this report."
          loading={loadingBlock}
          onExport={handleBlockReport}
        />

        <Separator />

        <ExportCard
          icon={Scale}
          title="BMI Progress Report"
          description={
            bodyEntries.length > 0
              ? `${bodyEntries.length} entr${bodyEntries.length !== 1 ? "ies" : "y"} · includes current metrics, progress summary and full history table`
              : "Includes current metrics, progress summary and full measurement history"
          }
          buttonLabel="Export BMI PDF"
          disabled={bodyEntries.length === 0}
          disabledReason="Add body composition entries in the Progress tab to enable this report."
          loading={loadingBmi}
          onExport={handleBmiReport}
        />
      </CardContent>
    </Card>
  );
}
