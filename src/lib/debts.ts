// Priorização e simulação de quitação de dívidas
import type { Debt } from "@/db/schema";

export type Strategy = "avalanche" | "snowball";

/**
 * Avalanche: paga primeiro a de MAIOR juros (economiza mais dinheiro).
 * Bola de neve: paga primeiro a de MENOR saldo (vitórias rápidas, motivação).
 */
export function prioritize<T extends Pick<Debt, "balanceCents" | "monthlyInterestRate">>(
  list: T[],
  strategy: Strategy,
): T[] {
  return [...list].sort((a, b) =>
    strategy === "avalanche"
      ? b.monthlyInterestRate - a.monthlyInterestRate || a.balanceCents - b.balanceCents
      : a.balanceCents - b.balanceCents || b.monthlyInterestRate - a.monthlyInterestRate,
  );
}

/** Taxa mensal -> anual equivalente (juros compostos) */
export function annualRate(monthlyPct: number): number {
  return (Math.pow(1 + monthlyPct / 100, 12) - 1) * 100;
}

export type Severity = "critica" | "alta" | "media" | "baixa";

export function severity(monthlyPct: number): Severity {
  if (monthlyPct >= 6) return "critica"; // cartão rotativo, cheque especial
  if (monthlyPct >= 3) return "alta"; // empréstimo pessoal
  if (monthlyPct >= 1) return "media"; // consignado, financiamento
  return "baixa"; // abaixo do CDI mensal ~ não vale antecipar
}

export const severityLabel: Record<Severity, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

/** Próxima data de vencimento a partir de hoje */
export function nextDueDate(dueDay: number, from = new Date()): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  const clamp = (yy: number, mm: number) => Math.min(dueDay, new Date(yy, mm + 1, 0).getDate());
  const thisMonth = new Date(y, m, clamp(y, m));
  const today = new Date(y, m, from.getDate());
  if (thisMonth >= today) return thisMonth;
  return new Date(y, m + 1, clamp(y, m + 1));
}

export function daysUntil(d: Date, from = new Date()): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

export type PayoffResult = {
  months: number;
  totalInterestCents: number;
  totalPaidCents: number;
  order: { id: string; name: string; paidOffMonth: number }[];
  feasible: boolean; // false se o pagamento não cobre nem os juros
};

/**
 * Simula mês a mês: paga o mínimo de todas, e o que sobrar do orçamento
 * vai para a dívida prioritária. Quando uma quita, o valor "rola" para a próxima.
 */
export function simulatePayoff(
  list: Pick<Debt, "id" | "name" | "balanceCents" | "monthlyInterestRate" | "minPaymentCents">[],
  monthlyBudgetCents: number,
  strategy: Strategy,
  maxMonths = 600,
): PayoffResult {
  const debts = prioritize(
    list.filter((d) => d.balanceCents > 0).map((d) => ({ ...d, bal: d.balanceCents })),
    strategy,
  );
  const order: PayoffResult["order"] = [];
  let month = 0;
  let totalInterest = 0;
  let totalPaid = 0;

  while (debts.some((d) => d.bal > 0) && month < maxMonths) {
    month++;
    // juros do mês
    for (const d of debts) {
      if (d.bal <= 0) continue;
      const interest = Math.round(d.bal * (d.monthlyInterestRate / 100));
      d.bal += interest;
      totalInterest += interest;
    }
    let budget = monthlyBudgetCents;
    // mínimos
    for (const d of debts) {
      if (d.bal <= 0) continue;
      const pay = Math.min(d.bal, d.minPaymentCents, budget);
      d.bal -= pay;
      budget -= pay;
      totalPaid += pay;
    }
    // extra na prioritária
    for (const d of debts) {
      if (budget <= 0) break;
      if (d.bal <= 0) continue;
      const pay = Math.min(d.bal, budget);
      d.bal -= pay;
      budget -= pay;
      totalPaid += pay;
    }
    for (const d of debts) {
      if (d.bal <= 0 && !order.find((o) => o.id === d.id)) {
        order.push({ id: d.id, name: d.name, paidOffMonth: month });
      }
    }
  }

  return {
    months: month,
    totalInterestCents: totalInterest,
    totalPaidCents: totalPaid,
    order,
    feasible: !debts.some((d) => d.bal > 0),
  };
}
