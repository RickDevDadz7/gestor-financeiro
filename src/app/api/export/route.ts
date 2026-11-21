import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import { db, customSheets } from "@/db";
import { getSession } from "@/lib/auth";
import { buildAutoSheets } from "@/lib/auto-sheets";
import { toExcelFormula } from "@/lib/sheet-engine";
import { todayBR } from "@/lib/money";

export const dynamic = "force-dynamic";

const FMT = {
  money: '"R$" #,##0.00;[Red]-"R$" #,##0.00',
  pct: '0.0"%"',
  number: "#,##0.######",
} as const;

export async function GET() {
  const s = await getSession();
  if (!s) return new Response("unauthorized", { status: 401 });

  const [auto, custom] = await Promise.all([
    buildAutoSheets(s.userId),
    db.select().from(customSheets).where(eq(customSheets.userId, s.userId)),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gestor Financeiro";
  wb.created = new Date();

  for (const sheet of auto) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = sheet.columns.map((c) => ({
      header: c.label,
      width: Math.max(12, c.label.length + 4, c.type === "text" ? 22 : 14),
    }));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16A34A" } };

    for (const r of sheet.rows) ws.addRow(r);
    if (sheet.totals && sheet.rows.length) {
      // totais como FÓRMULAS do Excel quando a coluna é de valores
      const first = 2;
      const last = sheet.rows.length + 1;
      const row = sheet.totals.map((v, i) => {
        const t = sheet.columns[i].type;
        const col = ws.getColumn(i + 1).letter;
        if (typeof v === "number" && t === "money")
          return { formula: `SUM(${col}${first}:${col}${last})`, result: v };
        return v;
      });
      const tr = ws.addRow(row);
      tr.font = { bold: true };
      tr.border = { top: { style: "thin" } };
    }
    sheet.columns.forEach((c, i) => {
      const fmt = c.type === "money" ? FMT.money : c.type === "pct" ? FMT.pct : c.type === "number" ? FMT.number : undefined;
      if (fmt) ws.getColumn(i + 1).numFmt = fmt;
    });
  }

  for (const cs of custom) {
    const ws = wb.addWorksheet(`✎ ${cs.name.replace(/[:\\/?*[\]]/g, " ")}`.slice(0, 31));
    for (const [ref, raw] of Object.entries(cs.cells)) {
      const cell = ws.getCell(ref);
      if (raw.startsWith("=")) cell.value = { formula: toExcelFormula(raw) };
      else {
        const n = Number(raw.replace(/\./g, "").replace(",", "."));
        cell.value = raw.trim() !== "" && Number.isFinite(n) && /^-?[\d.,]+$/.test(raw.trim()) ? n : raw;
      }
    }
    ws.columns.forEach((c) => (c.width = 16));
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="gestor-financeiro-${todayBR()}.xlsx"`,
    },
  });
}
