// Utilidades de dinheiro e datas (pt-BR)

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function fmtBRL(cents: number): string {
  return brl.format(cents / 100);
}

export function fmtNumber(n: number, digits = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmtNumber(n, digits)}%`;
}

/** "1.234,56" | "1234.56" | "1234,5" -> centavos */
export function parseToCents(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === "number") return Math.round(input * 100);
  let s = input.trim().replace(/[R$\s]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function parseNumber(input: string | null | undefined): number {
  if (!input) return 0;
  let s = input.trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Data de hoje em Brasília no formato AAAA-MM-DD */
export function todayBR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function monthRange(ym?: string): { start: Date; end: Date; ym: string } {
  const base = ym ?? todayBR().slice(0, 7);
  const [y, m] = base.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end, ym: base };
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
