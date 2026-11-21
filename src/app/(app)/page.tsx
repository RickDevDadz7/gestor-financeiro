import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { byCategory, getDebts, getGoals, getMonthTx, getValuedHoldings, journeyInput, latestSnapshot, monthlyHistory, sumTx } from "@/lib/data";
import { buildJourney } from "@/lib/journey";
import { daysUntil, nextDueDate, prioritize } from "@/lib/debts";
import { fmtBRL, monthLabel, todayBR } from "@/lib/money";
import { Badge, Card, Disclaimer, Empty, Progress, Stat } from "@/components/ui";
import { CashflowChart, CategoryBars } from "@/components/charts";
import { MarketBrief } from "@/components/market-brief";
import type { MarketData } from "@/lib/market-insights";

export default async function Dashboard() {
  const { userId, name } = await requireUser();
  const [monthTx, hist, debtList, valued, goalList, snap] = await Promise.all([
    getMonthTx(userId),
    monthlyHistory(userId, 6),
    getDebts(userId),
    getValuedHoldings(userId),
    getGoals(userId),
    latestSnapshot(),
  ]);
  const ji = await journeyInput(userId, { valued });
  const { steps, current } = buildJourney(ji);

  const { income, expense, balance } = sumTx(monthTx);
  const cats = byCategory(monthTx).slice(0, 6);
  const open = debtList.filter((d) => !d.paidOff);
  const totalDebt = open.reduce((a, b) => a + b.balanceCents, 0);
  const invested = valued.reduce((a, b) => a + b.valueCents, 0);
  const goalsSaved = goalList.reduce((a, b) => a + b.currentCents, 0);
  const netWorth = invested + goalsSaved - totalDebt;

  const upcoming = open
    .map((d) => ({ ...d, due: nextDueDate(d.dueDay) }))
    .map((d) => ({ ...d, days: daysUntil(d.due) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);
  const firstTarget = prioritize(open, "avalanche")[0];

  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <>
      <div className="mb-5">
        <p className="text-sm text-muted">{greet}, {name.split(" ")[0]} · {monthLabel(todayBR().slice(0, 7))}</p>
        <h1 className="text-2xl font-bold tracking-tight">Seu painel</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Receitas do mês" cents={income} tone="up" />
        <Stat label="Despesas do mês" cents={expense} tone="down" />
        <Stat label="Sobra do mês" cents={balance} tone="auto" hint={income ? `${Math.round((balance / income) * 100)}% da renda` : undefined} />
        <Stat label="Patrimônio líquido" cents={netWorth} tone="auto" hint="investido + metas − dívidas" />
      </div>

      {/* Jornada */}
      <Card title="Sua jornada: do zero à riqueza" className="mt-4">
        <div className="mb-4 flex gap-1">
          {steps.map((s) => (
            <div key={s.n} className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-brand" : s.n === current.n ? "bg-warn" : "bg-panel-2"}`} />
          ))}
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge tone="warn">Etapa {current.n} de {steps.length}</Badge>
            <h3 className="mt-2 text-lg font-semibold">{current.title}</h3>
            <p className="mt-1 text-sm text-muted">{current.why}</p>
            <p className="mt-3 text-sm"><span className="text-brand">Próximo passo →</span> {current.action}</p>
          </div>
          <div className="mt-3 w-full sm:mt-0 sm:w-48">
            <div className="mb-1 flex justify-between text-xs text-muted"><span>Progresso</span><span className="num">{Math.round(current.progress * 100)}%</span></div>
            <Progress value={current.progress} tone="warn" />
          </div>
        </div>
        <details className="mt-4">
          <summary className="text-xs text-muted hover:text-ink">Ver todas as etapas</summary>
          <ol className="mt-3 space-y-2">
            {steps.map((s) => (
              <li key={s.n} className="flex items-center gap-3 text-sm">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${s.done ? "bg-brand text-black" : "bg-panel-2 text-muted"}`}>{s.done ? "✓" : s.n}</span>
                <span className={s.done ? "text-muted line-through" : ""}>{s.title}</span>
              </li>
            ))}
          </ol>
        </details>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Receitas x despesas (6 meses)" className="lg:col-span-2">
          <CashflowChart data={hist.map((h) => ({ label: monthLabel(h.ym).slice(0, 3), receitas: h.income / 100, despesas: h.expense / 100 }))} />
        </Card>

        <Card title="Próximos vencimentos" action={<Link href="/dividas" className="text-xs text-brand">ver dívidas</Link>}>
          {upcoming.length === 0 ? (
            <Empty>Nenhuma dívida cadastrada. 🎉</Empty>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted">{d.due.toLocaleDateString("pt-BR")} · <span className="num">{fmtBRL(d.minPaymentCents)}</span></div>
                  </div>
                  <Badge tone={d.days <= 3 ? "down" : d.days <= 7 ? "warn" : "muted"}>{d.days === 0 ? "hoje" : `${d.days}d`}</Badge>
                </li>
              ))}
            </ul>
          )}
          {firstTarget && (
            <p className="mt-4 rounded-lg bg-panel-2 p-3 text-xs text-muted">
              Prioridade nº 1: <span className="text-ink">{firstTarget.name}</span> ({String(firstTarget.monthlyInterestRate).replace(".", ",")}% a.m.). Toda sobra vai pra ela.
            </p>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Onde o dinheiro foi este mês" action={<Link href="/transacoes" className="text-xs text-brand">lançar</Link>}>
          {cats.length ? <CategoryBars data={cats.map((c) => ({ category: c.category, value: c.cents / 100 }))} /> : <Empty>Lance seus gastos para ver o raio-x.</Empty>}
        </Card>

        <Card title="Investimentos" action={<Link href="/investimentos" className="text-xs text-brand">carteira</Link>}>
          <div className="num text-2xl font-semibold">{fmtBRL(invested)}</div>
          <div className={`num text-sm ${valued.reduce((a, b) => a + b.pnlCents, 0) >= 0 ? "text-up" : "text-down"}`}>
            {fmtBRL(valued.reduce((a, b) => a + b.pnlCents, 0))} de resultado
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {valued.slice(0, 5).map((h) => (
              <li key={h.id} className="flex justify-between">
                <span className="text-muted">{h.ticker.toUpperCase()}</span>
                <span className="num">{fmtBRL(h.valueCents)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Mercado hoje" action={<Link href="/mercado" className="text-xs text-brand">detalhes</Link>}>
          {snap ? (
            <MarketBrief data={snap.data as MarketData} summary={snap.summary} compact />
          ) : (
            <Empty>O primeiro resumo diário aparece aqui depois que o cron rodar (ou clique em “Atualizar” na aba Mercado).</Empty>
          )}
        </Card>
      </div>

      {goalList.length > 0 && (
        <Card title="Metas" className="mt-4" action={<Link href="/metas" className="text-xs text-brand">todas</Link>}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goalList.slice(0, 3).map((g) => (
              <div key={g.id}>
                <div className="mb-1 flex justify-between text-sm"><span>{g.name}</span><span className="num text-muted">{Math.round((g.currentCents / g.targetCents) * 100)}%</span></div>
                <Progress value={g.currentCents / g.targetCents} />
                <div className="num mt-1 text-xs text-muted">{fmtBRL(g.currentCents)} de {fmtBRL(g.targetCents)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Disclaimer />
    </>
  );
}
