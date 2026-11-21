import "server-only";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db, transactions, debts, holdings, goals, marketSnapshots } from "@/db";
import type { Holding } from "@/db/schema";
import { monthRange, shiftMonth } from "./money";
import { b3Quotes, cryptoQuotes } from "./market";
import type { JourneyInput } from "./journey";

export async function getMonthTx(userId: string, ym?: string) {
  const { start, end } = monthRange(ym);
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.date, start), lt(transactions.date, end)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
}

export function sumTx(list: { type: string; amountCents: number }[]) {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === "INCOME") income += t.amountCents;
    else expense += t.amountCents;
  }
  return { income, expense, balance: income - expense };
}

export function byCategory(list: { type: string; amountCents: number; category: string }[]) {
  const map = new Map<string, number>();
  for (const t of list) if (t.type === "EXPENSE") map.set(t.category, (map.get(t.category) ?? 0) + t.amountCents);
  return [...map.entries()].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents);
}

/** Receitas e despesas por mês (últimos N meses, incluindo o atual) */
export async function monthlyHistory(userId: string, months = 6, ym?: string) {
  const last = monthRange(ym).ym;
  const first = shiftMonth(last, -(months - 1));
  const { start } = monthRange(first);
  const { end } = monthRange(last);
  const rows = await db
    .select({
      ym: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      type: transactions.type,
      total: sql<number>`sum(${transactions.amountCents})::int`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.date, start), lt(transactions.date, end)))
    .groupBy(sql`1`, transactions.type);

  const out: { ym: string; income: number; expense: number }[] = [];
  for (let i = 0; i < months; i++) {
    const m = shiftMonth(first, i);
    out.push({
      ym: m,
      income: rows.find((r) => r.ym === m && r.type === "INCOME")?.total ?? 0,
      expense: rows.find((r) => r.ym === m && r.type === "EXPENSE")?.total ?? 0,
    });
  }
  return out;
}

export async function getDebts(userId: string) {
  return db.select().from(debts).where(eq(debts.userId, userId)).orderBy(asc(debts.dueDay));
}

export async function getGoals(userId: string) {
  return db.select().from(goals).where(eq(goals.userId, userId)).orderBy(asc(goals.createdAt));
}

export type ValuedHolding = Holding & {
  priceCents: number | null;
  valueCents: number;
  costCents: number;
  pnlCents: number;
  pnlPct: number;
  dayChangePct: number | null;
};

export const KIND_LABEL: Record<Holding["kind"], string> = {
  STOCK: "Ações BR",
  FII: "FIIs",
  ETF: "ETFs",
  CRYPTO: "Cripto",
  FIXED_INCOME: "Renda fixa",
  STOCK_US: "Exterior",
};

export async function getValuedHoldings(userId: string): Promise<ValuedHolding[]> {
  const list = await db.select().from(holdings).where(eq(holdings.userId, userId)).orderBy(asc(holdings.kind));
  const b3 = list.filter((h) => ["STOCK", "FII", "ETF"].includes(h.kind)).map((h) => h.ticker);
  const cr = list.filter((h) => h.kind === "CRYPTO").map((h) => h.ticker);
  const [bq, cq] = await Promise.all([b3Quotes(b3), cryptoQuotes(cr)]);

  return list.map((h) => {
    const q =
      h.kind === "CRYPTO"
        ? cq.find((x) => x.symbol === h.ticker.toLowerCase())
        : bq.find((x) => x.symbol === h.ticker.toUpperCase());
    const costCents = Math.round(h.quantity * h.avgPriceCents);
    const priceCents = q ? Math.round(q.priceBRL * 100) : null;
    const valueCents =
      h.manualValueCents ?? (priceCents !== null ? Math.round(h.quantity * priceCents) : costCents);
    const pnlCents = valueCents - costCents;
    return {
      ...h,
      priceCents,
      valueCents,
      costCents,
      pnlCents,
      pnlPct: costCents ? (pnlCents / costCents) * 100 : 0,
      dayChangePct: q?.changePct ?? null,
    };
  });
}

export async function latestSnapshot() {
  const [s] = await db.select().from(marketSnapshots).orderBy(desc(marketSnapshots.day)).limit(1);
  return s ?? null;
}

export async function recentSnapshots(n = 14) {
  return db.select().from(marketSnapshots).orderBy(desc(marketSnapshots.day)).limit(n);
}

const RESERVE_RE = /reserva|emerg/i;

export async function journeyInput(userId: string, opts?: { valued?: ValuedHolding[] }): Promise<JourneyInput> {
  const [monthTx, hist, dlist, glist, valued] = await Promise.all([
    getMonthTx(userId),
    monthlyHistory(userId, 3),
    getDebts(userId),
    getGoals(userId),
    opts?.valued ? Promise.resolve(opts.valued) : getValuedHoldings(userId),
  ]);
  const { income, expense } = sumTx(monthTx);
  const withExpense = hist.filter((h) => h.expense > 0);
  const avg = withExpense.length ? withExpense.reduce((a, b) => a + b.expense, 0) / withExpense.length : 0;
  const open = dlist.filter((d) => !d.paidOff);
  const fixed = valued.filter((h) => h.kind === "FIXED_INCOME").reduce((a, b) => a + b.valueCents, 0);
  const reserveGoals = glist.filter((g) => RESERVE_RE.test(g.name)).reduce((a, b) => a + b.currentCents, 0);
  return {
    monthIncomeCents: income,
    monthExpenseCents: expense,
    avgMonthlyExpenseCents: Math.round(avg),
    hasTransactionsThisMonth: monthTx.length > 0,
    expensiveDebtCents: open.filter((d) => d.monthlyInterestRate >= 1).reduce((a, b) => a + b.balanceCents, 0),
    totalDebtCents: open.reduce((a, b) => a + b.balanceCents, 0),
    liquidReserveCents: fixed + reserveGoals,
    investedCents: valued.reduce((a, b) => a + b.valueCents, 0),
  };
}
