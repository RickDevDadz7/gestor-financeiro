// "Do zero à riqueza": escada de etapas com base nos SEUS números.
// Regras transparentes (sem caixa-preta). Não é recomendação de investimento.

export type JourneyInput = {
  monthIncomeCents: number;
  monthExpenseCents: number;
  avgMonthlyExpenseCents: number; // média dos últimos 3 meses
  hasTransactionsThisMonth: boolean;
  expensiveDebtCents: number; // dívidas com juros >= 1% a.m.
  totalDebtCents: number;
  liquidReserveCents: number; // renda fixa + metas marcadas como reserva
  investedCents: number; // patrimônio investido total
};

export type Step = {
  n: number;
  title: string;
  why: string;
  done: boolean;
  progress: number; // 0..1
  action: string;
};

export function buildJourney(i: JourneyInput): { steps: Step[]; current: Step } {
  const expense = Math.max(i.avgMonthlyExpenseCents, i.monthExpenseCents, 1);
  const surplus = i.monthIncomeCents - i.monthExpenseCents;
  const savingsRate = i.monthIncomeCents > 0 ? surplus / i.monthIncomeCents : 0;
  const fiTarget = expense * 12 * 25; // regra dos 4% (25x o gasto anual)

  const steps: Step[] = [
    {
      n: 1,
      title: "Enxergar o dinheiro",
      why: "Ninguém controla o que não mede. Registre receitas e gastos do mês.",
      done: i.hasTransactionsThisMonth && i.monthIncomeCents > 0,
      progress: i.hasTransactionsThisMonth ? (i.monthIncomeCents > 0 ? 1 : 0.5) : 0,
      action: "Lance sua renda e seus gastos fixos em Transações.",
    },
    {
      n: 2,
      title: "Gastar menos do que ganha",
      why: "Sem sobra mensal, nenhuma estratégia funciona. Meta: sobrar pelo menos 10%.",
      done: savingsRate >= 0.1,
      progress: clamp(savingsRate / 0.1),
      action:
        surplus < 0
          ? `Você está ${fmt(-surplus)} no negativo este mês. Corte a maior categoria de gasto primeiro.`
          : "Aumente a sobra: renegocie contas fixas e busque renda extra.",
    },
    {
      n: 3,
      title: "Mini-reserva (1 mês de gastos)",
      why: "Um colchão pequeno evita que um imprevisto vire dívida nova.",
      done: i.liquidReserveCents >= expense,
      progress: clamp(i.liquidReserveCents / expense),
      action: `Guarde ${fmt(Math.max(expense - i.liquidReserveCents, 0))} em algo com liquidez diária (Tesouro Selic / CDB 100% CDI).`,
    },
    {
      n: 4,
      title: "Matar dívidas caras",
      why: "Juro de cartão/cheque especial passa de 100% ao ano. Nenhum investimento rende isso.",
      done: i.expensiveDebtCents === 0,
      progress: i.totalDebtCents === 0 ? 1 : clamp(1 - i.expensiveDebtCents / i.totalDebtCents),
      action: "Siga a ordem da aba Dívidas (método avalanche) e jogue toda sobra na primeira.",
    },
    {
      n: 5,
      title: "Reserva de emergência (6 meses)",
      why: "Te dá liberdade de dizer não, trocar de emprego, se mudar de país.",
      done: i.liquidReserveCents >= expense * 6,
      progress: clamp(i.liquidReserveCents / (expense * 6)),
      action: `Faltam ${fmt(Math.max(expense * 6 - i.liquidReserveCents, 0))} para 6 meses de gastos.`,
    },
    {
      n: 6,
      title: "Investir 20%+ da renda todo mês",
      why: "Juros compostos precisam de tempo e constância. Diversifique: renda fixa, ações, FIIs, exterior, um pouco de cripto.",
      done: savingsRate >= 0.2 && i.investedCents > i.liquidReserveCents,
      progress: clamp(savingsRate / 0.2),
      action: "Defina um aporte automático no dia do salário.",
    },
    {
      n: 7,
      title: "Independência financeira",
      why: "Patrimônio ≈ 25x seu gasto anual: os rendimentos pagam sua vida.",
      done: i.investedCents >= fiTarget,
      progress: clamp(i.investedCents / fiTarget),
      action: `Meta: ${fmt(fiTarget)} investidos.`,
    },
  ];

  const current = steps.find((s) => !s.done) ?? steps[steps.length - 1];
  return { steps, current };
}

function clamp(n: number) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
