import "server-only";
// "Excel automático": planilhas montadas a partir dos seus dados.
// O mesmo formato alimenta a tela de Planilhas e a exportação .xlsx.
import { and, asc, eq, gte } from "drizzle-orm";
import { db, transactions } from "@/db";
import { getDebts, getGoals, getValuedHoldings, monthlyHistory, KIND_LABEL } from "./data";
import { annualRate, nextDueDate, prioritize, severity, severityLabel } from "./debts";
import { monthLabel, shiftMonth, todayBR, monthRange } from "./money";

export type ColType = "text" | "money" | "number" | "pct" | "date";
export type AutoSheet = {
  key: string;
  name: string;
  description: string;
  columns: { label: string; type: ColType }[];
  rows: (string | number | null)[][]; // valores monetários em REAIS (não centavos)
  totals?: (string | number | null)[];
};

const R = (cents: number) => cents / 100;

export async function buildAutoSheets(userId: string): Promise<AutoSheet[]> {
  const twelveAgo = monthRange(shiftMonth(todayBR().slice(0, 7), -11)).start;
  const [hist, dl, valued, gl, txs] = await Promise.all([
    monthlyHistory(userId, 12),
    getDebts(userId),
    getValuedHoldings(userId),
    getGoals(userId),
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.date, twelveAgo)))
      .orderBy(asc(transactions.date)),
  ]);

  // 1. Fluxo de caixa mensal
  let acc = 0;
  const flowRows = hist.map((h) => {
    const bal = h.income - h.expense;
    acc += bal;
    const rate = h.income ? (bal / h.income) * 100 : 0;
    return [monthLabel(h.ym), R(h.income), R(h.expense), R(bal), rate, R(acc)];
  });
  const tIn = hist.reduce((a, b) => a + b.income, 0);
  const tOut = hist.reduce((a, b) => a + b.expense, 0);

  // 2. Gastos por categoria x mês (últimos 6)
  const months = hist.slice(-6).map((h) => h.ym);
  const cats = [...new Set(txs.filter((t) => t.type === "EXPENSE").map((t) => t.category))].sort();
  const catRows = cats.map((c) => {
    const vals = months.map((m) =>
      R(
        txs
          .filter((t) => t.type === "EXPENSE" && t.category === c && t.date.toISOString().slice(0, 7) === m)
          .reduce((a, b) => a + b.amountCents, 0),
      ),
    );
    return [c, ...vals, vals.reduce((a, b) => a + b, 0) / (vals.length || 1)];
  });

  // 3. Dívidas priorizadas
  const open = prioritize(dl.filter((d) => !d.paidOff), "avalanche");
  const debtRows = open.map((d, i) => [
    i + 1,
    d.name,
    d.creditor ?? "",
    R(d.balanceCents),
    d.monthlyInterestRate,
    annualRate(d.monthlyInterestRate),
    R(d.minPaymentCents),
    nextDueDate(d.dueDay).toLocaleDateString("pt-BR"),
    severityLabel[severity(d.monthlyInterestRate)],
  ]);

  // 4. Carteira
  const totalInv = valued.reduce((a, b) => a + b.valueCents, 0);
  const invRows = valued.map((h) => [
    KIND_LABEL[h.kind],
    h.ticker.toUpperCase(),
    h.quantity,
    R(h.avgPriceCents),
    h.priceCents !== null ? R(h.priceCents) : null,
    R(h.valueCents),
    R(h.pnlCents),
    h.pnlPct,
    totalInv ? (h.valueCents / totalInv) * 100 : 0,
  ]);

  // 5. Metas
  const goalRows = gl.map((g) => [
    g.name,
    R(g.targetCents),
    R(g.currentCents),
    R(Math.max(g.targetCents - g.currentCents, 0)),
    g.targetCents ? (g.currentCents / g.targetCents) * 100 : 0,
    g.deadline ? g.deadline.toLocaleDateString("pt-BR") : "",
  ]);

  // 6. Lançamentos (extrato)
  const txRows = [...txs].reverse().map((t) => [
    t.date.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
    t.type === "INCOME" ? "Receita" : "Despesa",
    t.category,
    t.description,
    R(t.type === "INCOME" ? t.amountCents : -t.amountCents),
  ]);

  return [
    {
      key: "fluxo",
      name: "Fluxo de caixa",
      description: "Receitas, despesas e saldo acumulado dos últimos 12 meses.",
      columns: [
        { label: "Mês", type: "text" },
        { label: "Receitas", type: "money" },
        { label: "Despesas", type: "money" },
        { label: "Saldo", type: "money" },
        { label: "Taxa de poupança", type: "pct" },
        { label: "Acumulado", type: "money" },
      ],
      rows: flowRows,
      totals: ["Total", R(tIn), R(tOut), R(tIn - tOut), tIn ? ((tIn - tOut) / tIn) * 100 : 0, null],
    },
    {
      key: "categorias",
      name: "Gastos por categoria",
      description: "Quanto cada categoria consumiu nos últimos 6 meses e a média mensal.",
      columns: [
        { label: "Categoria", type: "text" },
        ...months.map((m) => ({ label: monthLabel(m).split(" ")[0], type: "money" as const })),
        { label: "Média", type: "money" },
      ],
      rows: catRows,
    },
    {
      key: "dividas",
      name: "Dívidas (ordem de ataque)",
      description: "Ordenadas pelo método avalanche: maior juros primeiro.",
      columns: [
        { label: "#", type: "number" },
        { label: "Dívida", type: "text" },
        { label: "Credor", type: "text" },
        { label: "Saldo", type: "money" },
        { label: "Juros a.m.", type: "pct" },
        { label: "Juros a.a.", type: "pct" },
        { label: "Parcela mín.", type: "money" },
        { label: "Próx. vencimento", type: "date" },
        { label: "Gravidade", type: "text" },
      ],
      rows: debtRows,
      totals: ["", "Total", "", R(open.reduce((a, b) => a + b.balanceCents, 0)), null, null, R(open.reduce((a, b) => a + b.minPaymentCents, 0)), "", ""],
    },
    {
      key: "carteira",
      name: "Carteira de investimentos",
      description: "Posição atual com cotação do dia, lucro/prejuízo e peso de cada ativo.",
      columns: [
        { label: "Classe", type: "text" },
        { label: "Ativo", type: "text" },
        { label: "Qtd.", type: "number" },
        { label: "Preço médio", type: "money" },
        { label: "Cotação", type: "money" },
        { label: "Valor atual", type: "money" },
        { label: "Lucro/Prej.", type: "money" },
        { label: "Rentab.", type: "pct" },
        { label: "Peso", type: "pct" },
      ],
      rows: invRows,
      totals: ["Total", "", null, null, null, R(totalInv), R(valued.reduce((a, b) => a + b.pnlCents, 0)), null, 100],
    },
    {
      key: "metas",
      name: "Metas",
      description: "Progresso de cada objetivo financeiro.",
      columns: [
        { label: "Meta", type: "text" },
        { label: "Alvo", type: "money" },
        { label: "Guardado", type: "money" },
        { label: "Falta", type: "money" },
        { label: "Progresso", type: "pct" },
        { label: "Prazo", type: "date" },
      ],
      rows: goalRows,
    },
    {
      key: "extrato",
      name: "Extrato (12 meses)",
      description: "Todos os lançamentos, do mais recente ao mais antigo.",
      columns: [
        { label: "Data", type: "date" },
        { label: "Tipo", type: "text" },
        { label: "Categoria", type: "text" },
        { label: "Descrição", type: "text" },
        { label: "Valor", type: "money" },
      ],
      rows: txRows,
      totals: ["", "", "", "Saldo", txRows.reduce((a, r) => a + (r[4] as number), 0)],
    },
  ];
}

export { KIND_LABEL };
