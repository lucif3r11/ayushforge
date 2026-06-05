"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import {
  Plus,
  X,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Scale,
  Activity,
  Flame,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { BodyEntry } from "@/lib/types";
import BackupRestore from "./BackupRestore";
import InstallBanner from "./InstallBanner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Underweight", color: "text-blue-500" };
  if (bmi < 25)   return { label: "Normal",      color: "text-green-500" };
  if (bmi < 30)   return { label: "Overweight",  color: "text-amber-500" };
  return               { label: "Obese",         color: "text-red-500"  };
}

function diff(current: number | undefined, previous: number | undefined) {
  if (current === undefined || previous === undefined) return null;
  return parseFloat((current - previous).toFixed(2));
}

function fmt(n: number | undefined, decimals = 1) {
  return n !== undefined ? n.toFixed(decimals) : "—";
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({
  active, payload, label, unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-medium mb-0.5">{label}</p>
      <p className="text-muted-foreground">
        {payload[0].value}
        {unit ?? ""}
      </p>
    </div>
  );
}

// ─── Trend delta chip ────────────────────────────────────────────────────────

function Delta({
  value,
  unit = "",
  positiveIsGood = false,
}: {
  value: number | null;
  unit?: string;
  positiveIsGood?: boolean;
}) {
  if (value === null) return null;
  const isZero = value === 0;
  const isPositive = value > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;

  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-xs font-medium",
        isZero
          ? "text-muted-foreground"
          : isGood
          ? "text-green-500"
          : "text-red-500"
      )}
    >
      {isZero ? (
        <Minus className="h-3 w-3" />
      ) : isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isPositive ? "+" : ""}
      {value}
      {unit}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  delta,
  deltaUnit,
  sub,
  icon: Icon,
  positiveIsGood,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number | null;
  deltaUnit?: string;
  sub?: string;
  icon: React.ElementType;
  positiveIsGood?: boolean;
}) {
  return (
    <Card className="border-l-2 border-l-primary">
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.75} />
        </div>
        <div className="flex items-end gap-1 leading-none">
          <span className="text-3xl font-black tracking-tight">{value}</span>
          {unit && <span className="text-sm text-muted-foreground mb-0.5 font-medium">{unit}</span>}
        </div>
        <div className="flex items-center gap-2">
          {delta !== undefined && delta !== null && (
            <Delta value={delta} unit={deltaUnit} positiveIsGood={positiveIsGood} />
          )}
          {sub && <span className="text-[10px] text-muted-foreground font-medium">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Trend chart card ────────────────────────────────────────────────────────

function TrendChart({
  title,
  data,
  dataKey,
  color,
  unit,
  referenceValue,
  referenceLabel,
  emptyMessage,
}: {
  title: string;
  data: Array<Record<string, unknown>>;
  dataKey: string;
  color: string;
  unit?: string;
  referenceValue?: number;
  referenceLabel?: string;
  emptyMessage?: string;
}) {
  const isEmpty = data.length < 2;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isEmpty ? (
          <div className="h-36 flex items-center justify-center text-center">
            <p className="text-xs text-muted-foreground px-6">
              {emptyMessage ?? "Add at least 2 entries to see this chart."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<ChartTooltip unit={unit} />} />
              {referenceValue !== undefined && (
                <ReferenceLine
                  y={referenceValue}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  label={{
                    value: referenceLabel ?? "",
                    fontSize: 9,
                    fill: "hsl(var(--muted-foreground))",
                    position: "right",
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={{ fill: color, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Entry form (bottom sheet) ───────────────────────────────────────────────

interface EntryForm {
  date: string;
  weight: string;
  bmi: string;
  pbf: string;
  smm: string;
  inBodyScore: string;
  visceralFat: string;
  notes: string;
}

function emptyForm(): EntryForm {
  return {
    date: format(new Date(), "yyyy-MM-dd"),
    weight: "",
    bmi: "",
    pbf: "",
    smm: "",
    inBodyScore: "",
    visceralFat: "",
    notes: "",
  };
}

// ─── PDF extraction + InBody parser ──────────────────────────────────────────

interface PDFExtractResult {
  text: string;
  numPages: number;
  /** True when almost no selectable text was found — likely a scanned/image PDF */
  isImageBased: boolean;
}

async function extractPDFText(file: File): Promise<PDFExtractResult> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();

  // disableStream + disableAutoFetch prevent the ReadableStream crash that
  // occurs when pdfjs-dist 6.x tries to use browser streaming APIs on
  // image-based or non-standard PDFs.
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    disableStream: true,
    disableAutoFetch: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  let fullText = "";
  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      fullText += pageText + "\n";
    } catch {
      // Skip pages that fail (e.g. image-only pages inside a mixed PDF)
    }
  }

  // Image-based PDFs yield very little selectable text (typically 0–5 chars
  // of PDF metadata). Threshold: fewer than 20 non-whitespace chars per page.
  const meaningfulChars = fullText.replace(/\s/g, "").length;
  const isImageBased = meaningfulChars < numPages * 20;

  return { text: fullText, numPages, isImageBased };
}

function parseInBodyText(raw: string): Partial<EntryForm> {
  const result: Partial<EntryForm> = {};

  // Flatten: collapse runs of whitespace so labels + values land on one line
  const text = raw.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ");

  // ── Date — look for YYYY.MM.DD, YYYY-MM-DD, MM/DD/YYYY ───────────────────
  const dateYMD = text.match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/);
  const dateMDY = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dateYMD) {
    const [, y, m, d] = dateYMD;
    result.date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  } else if (dateMDY) {
    const [, m, d, y] = dateMDY;
    result.date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  let m: RegExpMatchArray | null;

  // ── Weight ────────────────────────────────────────────────────────────────
  m = text.match(/\bWeight\b\s*[:\-]?\s*(\d+\.?\d*)\s*kg/i) ||
      text.match(/\bWeight\b\s+(\d+\.?\d*)/i);
  if (m) result.weight = m[1];

  // ── Skeletal Muscle Mass ──────────────────────────────────────────────────
  m = text.match(/Skeletal Muscle Mass\s*[:\-]?\s*(\d+\.?\d*)/i) ||
      text.match(/\bSMM\b\s*[:\-]?\s*(\d+\.?\d*)/i);
  if (m) result.smm = m[1];

  // ── Percent Body Fat (NOT Body Fat Mass in kg) ────────────────────────────
  m = text.match(/Percent Body Fat\s*[:\-]?\s*(\d+\.?\d*)/i) ||
      text.match(/Body Fat Percentage\s*[:\-]?\s*(\d+\.?\d*)/i) ||
      text.match(/\bPBF\b\s*[:\-]?\s*(\d+\.?\d*)/i) ||
      text.match(/Body Fat\s*[:\-]?\s*(\d+\.?\d*)\s*%/i);
  if (m) result.pbf = m[1];

  // ── BMI ───────────────────────────────────────────────────────────────────
  m = text.match(/\bBMI\b\s*[:\-]?\s*(\d+\.?\d*)/i);
  if (m) result.bmi = m[1];

  // ── InBody Score ──────────────────────────────────────────────────────────
  m = text.match(/InBody Score\s*[:\-]?\s*(\d+)/i) ||
      text.match(/\bScore\b\s*[:\-]?\s*(\d+)(?!\.\d)/i);
  if (m) result.inBodyScore = m[1];

  // ── Visceral Fat Level ────────────────────────────────────────────────────
  m = text.match(/Visceral Fat Level\s*[:\-]?\s*(\d+)/i) ||
      text.match(/Visceral Fat Area\s*[:\-]?\s*(\d+\.?\d*)/i);
  if (m) result.visceralFat = m[1];

  return result;
}

type ParseQuality = "good" | "partial" | "unrecognised" | "image";

function EntryModal({
  open,
  onClose,
  onSave,
  initialValues,
  prefillSource,
  parseQuality,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: EntryForm) => void;
  initialValues?: Partial<EntryForm>;
  prefillSource?: string;
  parseQuality?: ParseQuality;
}) {
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...emptyForm(), ...initialValues });
      // Auto-open optional section if optional fields were pre-filled
      const hasOptional =
        !!initialValues?.inBodyScore ||
        !!initialValues?.visceralFat ||
        !!initialValues?.notes;
      setShowOptional(hasOptional);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(
    (field: keyof EntryForm) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value })),
    []
  );

  function handleSave() {
    if (!form.date) { toast.error("Date is required."); return; }
    if (!form.weight || parseFloat(form.weight) <= 0) {
      toast.error("Weight is required.");
      return;
    }
    onSave(form);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <h2 className="text-base font-semibold">Log New Measurement</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Separator />

        {/* Scrollable form */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* PDF import banner — colour and message vary by parse quality */}
          {parseQuality === "image" && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
              <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
                This PDF appears to be image-based (scanned). Text could not be
                extracted. Please fill in the values manually.
              </p>
            </div>
          )}
          {parseQuality === "unrecognised" && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
              <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
                {prefillSource
                  ? `"${prefillSource}" — format not recognised.`
                  : "PDF format not recognised."}{" "}
                Fill in the values manually below.
              </p>
            </div>
          )}
          {parseQuality === "partial" && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
              <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
                Partially extracted from{" "}
                {prefillSource ? `"${prefillSource}"` : "the PDF"}. Some fields
                could not be read — check and fill in the rest.
              </p>
            </div>
          )}
          {parseQuality === "good" && prefillSource && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
              <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Pre-filled from &ldquo;{prefillSource}&rdquo; — review and save.
              </p>
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="em-date">Date</Label>
            <Input id="em-date" type="date" value={form.date} onChange={set("date")} />
          </div>

          {/* Weight — required */}
          <div className="space-y-1.5">
            <Label htmlFor="em-weight">
              Weight (kg) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="em-weight"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 75.5"
              value={form.weight}
              onChange={set("weight")}
              step="0.1"
              min="0"
              autoFocus
            />
          </div>

          {/* SMM + Body Fat — primary metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="em-smm">SMM (kg)</Label>
              <Input
                id="em-smm"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 35.2"
                value={form.smm}
                onChange={set("smm")}
                step="0.1"
                min="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em-pbf">Body Fat %</Label>
              <Input
                id="em-pbf"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 18.5"
                value={form.pbf}
                onChange={set("pbf")}
                step="0.1"
                min="0"
                max="70"
              />
            </div>
          </div>

          {/* BMI — optional */}
          <div className="space-y-1.5">
            <Label htmlFor="em-bmi">BMI <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="em-bmi"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 22.5"
              value={form.bmi}
              onChange={set("bmi")}
              step="0.1"
              min="0"
            />
          </div>

          {/* Optional fields toggle */}
          <button
            type="button"
            onClick={() => setShowOptional((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showOptional
              ? <ChevronUp className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />}
            {showOptional ? "Hide" : "Show"} optional fields
          </button>

          {showOptional && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="em-inbody">InBody Score</Label>
                  <Input
                    id="em-inbody"
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 78"
                    value={form.inBodyScore}
                    onChange={set("inBodyScore")}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="em-visceral">Visceral Fat Lvl</Label>
                  <Input
                    id="em-visceral"
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 4"
                    value={form.visceralFat}
                    onChange={set("visceralFat")}
                    min="1"
                    max="20"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em-notes">Notes</Label>
                <Textarea
                  id="em-notes"
                  placeholder="Any context — fasted, post-workout…"
                  value={form.notes}
                  onChange={set("notes")}
                  className="min-h-[72px]"
                />
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Action buttons */}
        <div className="px-5 py-4 shrink-0 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            Save Entry
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── History table ────────────────────────────────────────────────────────────

function HistoryTable({
  entries,
  onDelete,
}: {
  entries: BodyEntry[];
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Scale className="h-7 w-7 text-primary/60" strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-sm">No measurements yet</p>
          <p className="text-xs text-muted-foreground">Tap "Add Entry" or "Import PDF" to log your first measurement.</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Date", "Weight", "BMI", "PBF %", "SMM kg", "Score", ""].map((h) => (
                <th
                  key={h}
                  className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-muted/40 transition-colors">
                <td className="px-3 py-3 font-medium whitespace-nowrap">
                  {format(parseISO(e.date), "MMM d, yyyy")}
                </td>
                <td className="px-3 py-3 tabular-nums">{e.weight}</td>
                <td className="px-3 py-3 tabular-nums">
                  <span className={bmiCategory(e.bmi).color}>{e.bmi}</span>
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">
                  {e.pbf !== undefined ? `${e.pbf}%` : "—"}
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">
                  {e.smm !== undefined ? e.smm : "—"}
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">
                  {e.inBodyScore !== undefined ? e.inBodyScore : "—"}
                </td>
                <td className="px-3 py-3">
                  <button
                    onClick={() => onDelete(e.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProgressSkeleton() {
  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-28 rounded bg-muted" />
        <div className="h-4 w-56 rounded bg-muted" />
      </div>
      <div className="h-12 rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted" />)}
      </div>
      {[0, 1, 2].map((i) => <div key={i} className="h-48 rounded-xl bg-muted" />)}
      <div className="h-40 rounded-xl bg-muted" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProgressContent() {
  const [mounted, setMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [prefillValues, setPrefillValues] = useState<Partial<EntryForm> | undefined>(undefined);
  const [prefillSource, setPrefillSource] = useState<string | undefined>(undefined);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const bodyEntries = useAppStore((s) => s.bodyEntries);
  const addBodyEntry = useAppStore((s) => s.addBodyEntry);
  const deleteBodyEntry = useAppStore((s) => s.deleteBodyEntry);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const sorted = useMemo(
    () => [...bodyEntries].sort((a, b) => b.date.localeCompare(a.date)),
    [bodyEntries]
  );

  const latest = sorted[0] ?? null;
  const previous = sorted[1] ?? null;

  // Chart data (oldest → newest for chronological display)
  const chartData = useMemo(
    () =>
      [...sorted].reverse().map((e) => ({
        date: format(parseISO(e.date), "MMM d"),
        weight: e.weight,
        bmi: e.bmi,
        pbf: e.pbf,
        smm: e.smm,
      })),
    [sorted]
  );

  // ── Save handler ──────────────────────────────────────────────────────────

  const handleSave = useCallback(
    (form: EntryForm) => {
      const bmiVal = form.bmi ? parseFloat(form.bmi) : 0;
      addBodyEntry({
        date: form.date,
        weight: parseFloat(form.weight),
        bmi: bmiVal,
        pbf: form.pbf ? parseFloat(form.pbf) : undefined,
        smm: form.smm ? parseFloat(form.smm) : undefined,
        inBodyScore: form.inBodyScore ? parseFloat(form.inBodyScore) : undefined,
        visceralFat: form.visceralFat ? parseFloat(form.visceralFat) : undefined,
        notes: form.notes.trim() || undefined,
      });
      const desc = [
        `${form.weight} kg`,
        form.bmi ? `BMI ${form.bmi}` : null,
        form.smm ? `SMM ${form.smm} kg` : null,
        form.pbf ? `${form.pbf}% fat` : null,
      ].filter(Boolean).join(" · ");
      toast.success("Measurement saved!", { description: desc });
      setSheetOpen(false);
    },
    [addBodyEntry]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteBodyEntry(id);
      toast.success("Entry deleted.");
    },
    [deleteBodyEntry]
  );

  // ── PDF import ────────────────────────────────────────────────────────────

  const [parseQuality, setParseQuality] = useState<ParseQuality | undefined>(undefined);

  const handlePDFUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      setPdfLoading(true);
      try {
        const { text, isImageBased } = await extractPDFText(file);

        // ── Image-based PDF ─────────────────────────────────────────────────
        if (isImageBased) {
          toast.warning("Image-based PDF detected.", {
            description:
              "This PDF is a scanned image — text cannot be extracted. " +
              "Upload a text-based PDF, or enter values manually.",
          });
          setPrefillValues({});
          setPrefillSource(file.name);
          setParseQuality("image");
          setSheetOpen(true);
          return;
        }

        // ── Try to parse InBody data ────────────────────────────────────────
        const parsed = parseInBodyText(text);
        const filledCount = Object.values(parsed).filter(
          (v) => v !== undefined && v !== ""
        ).length;

        if (filledCount === 0) {
          toast.info("PDF format not recognised.", {
            description:
              "The PDF contains text but no InBody fields were found. " +
              "Fill in the values manually below.",
          });
          setPrefillValues({});
          setPrefillSource(file.name);
          setParseQuality("unrecognised");
        } else if (filledCount < 3) {
          toast.info(`${filledCount} field${filledCount !== 1 ? "s" : ""} extracted — some missing.`, {
            description: "Check the highlighted fields and fill in the rest manually.",
          });
          setPrefillValues(parsed);
          setPrefillSource(file.name);
          setParseQuality("partial");
        } else {
          toast.success(`${filledCount} fields extracted from PDF.`, {
            description: "Review the values, then tap Save.",
          });
          setPrefillValues(parsed);
          setPrefillSource(file.name);
          setParseQuality("good");
        }

        setSheetOpen(true);
      } catch (err) {
        console.error("PDF parse error:", err);
        const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

        const isEncrypted  = msg.includes("encrypt") || msg.includes("password");
        const isStreamErr  = msg.includes("readablestream") || msg.includes("stream") || msg.includes("undefined is not a function");
        const isImageLike  = isStreamErr; // stream crashes almost always = image-based PDF

        if (isImageLike) {
          toast.warning("This PDF appears to be image-based.", {
            description:
              "Text could not be extracted (likely a scanned or photo PDF). " +
              "Please enter the values manually below.",
          });
          setPrefillValues({});
          setPrefillSource(file.name);
          setParseQuality("image");
        } else if (isEncrypted) {
          toast.error("PDF is password-protected.", {
            description: "Remove the password and try again, or enter values manually.",
          });
          setPrefillValues({});
          setPrefillSource(undefined);
          setParseQuality(undefined);
        } else {
          toast.error("Could not open this PDF.", {
            description:
              "The file may be corrupt or in an unsupported format. " +
              "You can still enter values manually.",
          });
          setPrefillValues({});
          setPrefillSource(undefined);
          setParseQuality(undefined);
        }

        // Always open manual entry as fallback — never leave the user stuck
        setSheetOpen(true);
      } finally {
        setPdfLoading(false);
      }
    },
    []
  );

  if (!mounted) return <ProgressSkeleton />;

  const weightDelta = diff(latest?.weight, previous?.weight);
  const bmiDelta = diff(latest?.bmi, previous?.bmi);
  const pbfDelta = diff(latest?.pbf, previous?.pbf);
  const smmDelta = diff(latest?.smm, previous?.smm);
  const curBmiCat = latest ? bmiCategory(latest.bmi) : null;

  return (
    <>
      <div className="p-4 pb-8 space-y-6 max-w-lg mx-auto">

        {/* ── Header ──────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Progress</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Body Composition & BMI Tracker
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {/* Import from PDF */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={pdfLoading}
              onClick={() => pdfInputRef.current?.click()}
            >
              {pdfLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              {pdfLoading ? "Reading…" : "Import PDF"}
            </Button>
            {/* Manual entry */}
            <Button
              onClick={() => {
                setPrefillValues(undefined);
                setPrefillSource(undefined);
                setSheetOpen(true);
              }}
              className="gap-1.5"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Add Entry
            </Button>
          </div>
        </div>

        {/* Hidden PDF file input */}
        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handlePDFUpload}
        />

        {/* ── Quick Stats ──────────────────────────────── */}
        <section>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-4">
            Current Metrics
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Weight"
              value={latest ? fmt(latest.weight) : "—"}
              unit="kg"
              delta={weightDelta}
              deltaUnit=" kg"
              sub={latest ? undefined : "no entries yet"}
              icon={Scale}
            />
            <StatCard
              label="BMI"
              value={latest ? fmt(latest.bmi) : "—"}
              delta={bmiDelta}
              sub={curBmiCat?.label}
              icon={Activity}
            />
            <StatCard
              label="Body Fat"
              value={latest?.pbf !== undefined ? fmt(latest.pbf) : "—"}
              unit={latest?.pbf !== undefined ? "%" : undefined}
              delta={pbfDelta}
              deltaUnit="%"
              positiveIsGood={false}
              sub={latest?.pbf === undefined ? "not logged" : undefined}
              icon={Flame}
            />
            <StatCard
              label="Muscle Mass"
              value={latest?.smm !== undefined ? fmt(latest.smm) : "—"}
              unit={latest?.smm !== undefined ? "kg" : undefined}
              delta={smmDelta}
              deltaUnit=" kg"
              positiveIsGood={true}
              sub={latest?.smm === undefined ? "not logged" : undefined}
              icon={Dumbbell}
            />
          </div>
        </section>

        {/* ── Trend Charts ─────────────────────────────── */}
        <section>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-4">
            Trends
          </p>
          <div className="space-y-4">
            <TrendChart
              title="Weight over time"
              data={chartData}
              dataKey="weight"
              color="hsl(220 70% 50%)"
              unit=" kg"
              emptyMessage="Add at least 2 entries to see your weight trend."
            />
            <TrendChart
              title="Body Fat % over time"
              data={chartData.filter((d) => d.pbf !== undefined)}
              dataKey="pbf"
              color="hsl(0 72% 51%)"
              unit="%"
              emptyMessage="Log PBF on 2+ entries to see this chart."
            />
            <TrendChart
              title="Muscle Mass (SMM) over time"
              data={chartData.filter((d) => d.smm !== undefined)}
              dataKey="smm"
              color="hsl(142 71% 45%)"
              unit=" kg"
              emptyMessage="Log SMM on 2+ entries to see this chart."
            />
          </div>
        </section>

        {/* ── History Table ────────────────────────────── */}
        <section>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-4">
            History
          </p>
          <HistoryTable entries={sorted} onDelete={handleDelete} />
        </section>

        {/* ── Backup & Restore ─────────────────────────── */}
        <section>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-4">
            Data
          </p>
          <BackupRestore />
        </section>

        {/* ── iPhone install instructions ──────────────── */}
        <section>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-4">
            Install App
          </p>
          <InstallBanner />
        </section>
      </div>

      {/* ── Entry modal ───────────────────────────────── */}
      <EntryModal
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setPrefillValues(undefined);
          setPrefillSource(undefined);
          setParseQuality(undefined);
        }}
        onSave={handleSave}
        initialValues={prefillValues}
        prefillSource={prefillSource}
        parseQuality={parseQuality}
      />
    </>
  );
}
