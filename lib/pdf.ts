/**
 * PDF generation utilities.
 * jsPDF and autotable are loaded via dynamic import() — they reference browser
 * globals (window, document) at module level and must not be imported
 * statically in any file that is pre-rendered on the server.
 */

import {
  format,
  parseISO,
  differenceInDays,
  isWithinInterval,
  startOfDay,
} from "date-fns";
import type { Block, WorkoutLog, BodyEntry, Routine } from "./types";
import { parseWeightKg } from "./utils";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  dark:  [24,  24,  27]  as [number, number, number],  // zinc-900
  mid:   [113, 113, 122] as [number, number, number],  // zinc-500
  light: [244, 244, 245] as [number, number, number],  // zinc-100
  white: [255, 255, 255] as [number, number, number],
  muted: [228, 228, 231] as [number, number, number],  // zinc-200
};

const PAGE_W = 210;
const MARGIN = 16;

// ─── Layout helpers ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addHeader(doc: any, title: string, sub: string): number {
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, PAGE_W, 40, "F");

  doc.setTextColor(...C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("AYUSHFORGE", MARGIN, 12);

  doc.setFontSize(17);
  doc.text(title, MARGIN, 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(sub, MARGIN, 33);

  doc.setTextColor(...C.dark);
  return 50;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addSection(doc: any, label: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.mid);
  doc.text(label, MARGIN, y);
  doc.setDrawColor(...C.light);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y + 2.5, PAGE_W - MARGIN, y + 2.5);
  doc.setTextColor(...C.dark);
  doc.setLineWidth(0.1);
  return y + 10;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addBody(doc: any, text: string, x: number, y: number, bold = false): number {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.dark);
  doc.text(text, x, y);
  return y + 5.5;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addMuted(doc: any, text: string, x: number, y: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.mid);
  doc.text(text, x, y);
  doc.setTextColor(...C.dark);
  return y + 5;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function statBox(doc: any, label: string, value: string, x: number, y: number, w: number) {
  doc.setFillColor(...C.light);
  doc.rect(x, y, w, 16, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.mid);
  doc.text(label, x + 3, y + 5.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.dark);
  doc.text(value, x + 3, y + 13);
}

const TABLE_HEAD = {
  fillColor: C.dark,
  textColor: C.white,
  fontStyle: "bold" as const,
  fontSize: 8,
  cellPadding: 3,
};

const TABLE_BODY = {
  fontSize: 8,
  textColor: C.dark,
  cellPadding: 3,
};

const TABLE_ALTERNATE = { fillColor: [250, 250, 252] as [number, number, number] };

// ─── Block Report ─────────────────────────────────────────────────────────────

export async function generateBlockReportPDF(
  block: Block,
  allLogs: WorkoutLog[],
  _routines: Routine[]
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const generatedAt = format(new Date(), "MMMM d, yyyy");
  let y = addHeader(doc, "Block Report", `Generated ${generatedAt}`);

  // ── Block details ─────────────────────────────────────────────────────────

  y = addSection(doc, "BLOCK DETAILS", y);

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(block.name, MARGIN, y);
  if (block.isActive) {
    doc.setFillColor(...[34, 197, 94] as [number, number, number]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.white);
    const labelW = doc.getTextWidth("ACTIVE") + 4;
    const nameW = doc.getTextWidth(block.name) + 4;
    doc.roundedRect(MARGIN + nameW, y - 5, labelW, 6, 1, 1, "F");
    doc.text("ACTIVE", MARGIN + nameW + 2, y - 0.5);
    doc.setTextColor(...C.dark);
  }
  y += 7;

  y = addMuted(doc, "GOAL", MARGIN, y);
  y = addBody(doc, block.goal, MARGIN, y);
  y += 2;

  const startD = parseISO(block.startDate);
  const endD   = block.endDate ? parseISO(block.endDate) : new Date();
  const duration = differenceInDays(endD, startD);
  const dateRange = `${format(startD, "MMM d, yyyy")}  →  ${
    block.endDate ? format(endD, "MMM d, yyyy") : "Ongoing"
  }`;
  y = addMuted(doc, "PERIOD", MARGIN, y);
  y = addBody(doc, `${dateRange}   (${duration} days)`, MARGIN, y);
  y += 4;

  // ── Stats ─────────────────────────────────────────────────────────────────

  y = addSection(doc, "SUMMARY", y);

  const start = startOfDay(parseISO(block.startDate));
  const end   = block.endDate ? startOfDay(parseISO(block.endDate)) : new Date();
  const inBlock = allLogs.filter((l) =>
    isWithinInterval(parseISO(l.date), { start, end })
  );

  const totalSets = inBlock.reduce(
    (a, l) => a + l.exercises.reduce((b, ex) => b + ex.sets.length, 0), 0
  );
  const rpeVals: number[] = [];
  inBlock.forEach((l) =>
    l.exercises.forEach((ex) =>
      ex.sets.forEach((s) => { if (s.rpe !== undefined) rpeVals.push(s.rpe); })
    )
  );
  const avgRpe =
    rpeVals.length > 0
      ? (rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length).toFixed(1)
      : "—";

  const bw = (PAGE_W - MARGIN * 2 - 6) / 3;
  statBox(doc, "WORKOUTS",  String(inBlock.length), MARGIN,          y, bw);
  statBox(doc, "TOTAL SETS", String(totalSets),     MARGIN + bw + 3, y, bw);
  statBox(doc, "AVG RPE",    avgRpe,                MARGIN + bw * 2 + 6, y, bw);
  y += 22;

  // ── Workout sessions ──────────────────────────────────────────────────────

  y = addSection(doc, "WORKOUT SESSIONS", y);

  const sessionRows = [...inBlock]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)
    .map((l) => [
      format(parseISO(l.date), "MMM d, yyyy"),
      l.routineName ?? "Free Workout",
      String(l.exercises.length),
      String(l.exercises.reduce((a, ex) => a + ex.sets.length, 0)),
      l.durationMinutes ? `${l.durationMinutes} min` : "—",
    ]);

  if (sessionRows.length === 0) {
    y = addMuted(doc, "No workouts logged in this block yet.", MARGIN, y);
    y += 4;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Date", "Routine", "Exercises", "Sets", "Duration"]],
      body: sessionRows,
      headStyles: TABLE_HEAD,
      bodyStyles: TABLE_BODY,
      alternateRowStyles: TABLE_ALTERNATE,
      margin: { left: MARGIN, right: MARGIN },
      theme: "plain",
      styles: { lineColor: C.muted, lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 35 },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "right" },
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
  }

  // ── Top exercises ─────────────────────────────────────────────────────────

  // Guard: start new page if < 40mm remaining
  const PAGE_H = 297;
  if (y > PAGE_H - 60) { doc.addPage(); y = 16; }

  y = addSection(doc, "TOP EXERCISES (BY BEST WEIGHT)", y);

  // Collect per-exercise: sessions count, best weight, best reps
  const exMap = new Map<string, { name: string; sessions: number; bestW: number; bestR: number }>();
  inBlock.forEach((l) =>
    l.exercises.forEach((ex) => {
      const cur = exMap.get(ex.exerciseId) ?? { name: ex.exerciseName, sessions: 0, bestW: 0, bestR: 0 };
      ex.sets.forEach((s) => {
        const w = parseWeightKg(s.weight);
        if (w > cur.bestW || (w === cur.bestW && s.reps > cur.bestR)) {
          cur.bestW = w;
          cur.bestR = s.reps;
        }
      });
      cur.sessions++;
      exMap.set(ex.exerciseId, cur);
    })
  );

  const exRows = [...exMap.values()]
    .filter((e) => e.bestW > 0)
    .sort((a, b) => b.bestW - a.bestW)
    .slice(0, 12)
    .map((e) => [
      e.name,
      String(e.sessions),
      `${e.bestW} kg`,
      String(e.bestR),
      `${Math.round(e.bestW * (1 + e.bestR / 30))} kg`,
    ]);

  if (exRows.length === 0) {
    addMuted(doc, "No exercise data available yet.", MARGIN, y);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Exercise", "Sessions", "Best Weight", "Best Reps", "Est. 1RM"]],
      body: exRows,
      headStyles: TABLE_HEAD,
      bodyStyles: TABLE_BODY,
      alternateRowStyles: TABLE_ALTERNATE,
      margin: { left: MARGIN, right: MARGIN },
      theme: "plain",
      styles: { lineColor: C.muted, lineWidth: 0.2 },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "right" },
        3: { halign: "center" },
        4: { halign: "right" },
      },
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageCount: number = (doc as any).getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.mid);
    doc.text(`Ironclad Block Report  ·  Page ${p} of ${pageCount}`, PAGE_W / 2, 290, { align: "center" });
  }

  const slug = block.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  doc.save(`ironclad-block-${slug}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ─── BMI / Body Composition Report ───────────────────────────────────────────

export async function generateBmiReportPDF(entries: BodyEntry[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const first  = sorted[sorted.length - 1];
  const generatedAt = format(new Date(), "MMMM d, yyyy");

  let y = addHeader(doc, "Body Composition Report", `Generated ${generatedAt}`);

  // ── Current metrics ───────────────────────────────────────────────────────

  y = addSection(doc, "CURRENT METRICS", y);

  const bmiLabel = (bmi: number) => {
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25)   return "Normal";
    if (bmi < 30)   return "Overweight";
    return "Obese";
  };

  const half = (PAGE_W - MARGIN * 2 - 4) / 2;
  statBox(doc, "WEIGHT",       `${latest.weight} kg`,                MARGIN,          y, half);
  statBox(doc, "BMI",          `${latest.bmi} (${bmiLabel(latest.bmi)})`, MARGIN + half + 4, y, half);
  y += 20;
  statBox(doc, "BODY FAT %",   latest.pbf !== undefined ? `${latest.pbf}%` : "—",  MARGIN, y, half);
  statBox(doc, "MUSCLE MASS",  latest.smm !== undefined ? `${latest.smm} kg` : "—", MARGIN + half + 4, y, half);
  y += 22;

  if (latest.inBodyScore !== undefined) {
    const fw = (PAGE_W - MARGIN * 2 - 4) / 2;
    statBox(doc, "INBODY SCORE", String(latest.inBodyScore), MARGIN, y, fw);
    if (latest.visceralFat !== undefined) {
      statBox(doc, "VISCERAL FAT LEVEL", String(latest.visceralFat), MARGIN + fw + 4, y, fw);
    }
    y += 20;
  }

  // ── Progress since first entry ────────────────────────────────────────────

  if (first !== latest) {
    y = addSection(doc, "PROGRESS (FIRST → LATEST)", y);

    const diff = (cur: number | undefined, base: number | undefined, unit: string) => {
      if (cur === undefined || base === undefined) return "—";
      const d = parseFloat((cur - base).toFixed(2));
      return `${base} → ${cur} ${unit}   (${d >= 0 ? "+" : ""}${d} ${unit})`;
    };

    y = addBody(doc, `Period:       ${format(parseISO(first.date), "MMM d, yyyy")} → ${format(parseISO(latest.date), "MMM d, yyyy")}  (${differenceInDays(parseISO(latest.date), parseISO(first.date))} days)`, MARGIN, y);
    y = addBody(doc, `Weight:       ${diff(latest.weight, first.weight, "kg")}`, MARGIN, y);
    y = addBody(doc, `BMI:          ${diff(latest.bmi, first.bmi, "")}`, MARGIN, y);
    if (latest.pbf !== undefined && first.pbf !== undefined)
      y = addBody(doc, `Body Fat:     ${diff(latest.pbf, first.pbf, "%")}`, MARGIN, y);
    if (latest.smm !== undefined && first.smm !== undefined)
      y = addBody(doc, `Muscle Mass:  ${diff(latest.smm, first.smm, "kg")}`, MARGIN, y);
    y += 4;
  }

  // ── History table ─────────────────────────────────────────────────────────

  y = addSection(doc, "MEASUREMENT HISTORY", y);

  const histRows = sorted.map((e) => [
    format(parseISO(e.date), "MMM d, yyyy"),
    `${e.weight} kg`,
    String(e.bmi),
    e.pbf !== undefined ? `${e.pbf}%` : "—",
    e.smm !== undefined ? `${e.smm} kg` : "—",
    e.inBodyScore !== undefined ? String(e.inBodyScore) : "—",
    e.visceralFat !== undefined ? String(e.visceralFat) : "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Date", "Weight", "BMI", "Body Fat", "Muscle", "InBody", "Visc."]],
    body: histRows,
    headStyles: TABLE_HEAD,
    bodyStyles: TABLE_BODY,
    alternateRowStyles: TABLE_ALTERNATE,
    margin: { left: MARGIN, right: MARGIN },
    theme: "plain",
    styles: { lineColor: C.muted, lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 33 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageCount: number = (doc as any).getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.mid);
    doc.text(`Ironclad Body Composition Report  ·  Page ${p} of ${pageCount}`, PAGE_W / 2, 290, { align: "center" });
  }

  doc.save(`ironclad-bmi-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
