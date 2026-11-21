import { requireUser } from "@/lib/auth";
import { getGoals, getMonthTx, sumTx } from "@/lib/data";
import { fmtBRL } from "@/lib/money";
import { AddPanel, Card, Empty, PageHeader, Progress } from "@/components/ui";
import { DeleteButton, DepositForm, GoalForm } from "@/components/forms";

export default async function Metas() {
  const { userId } = await requireUser();
  const [list, monthTx] = await Promise.all([getGoals(userId), getMonthTx(userId)]);
  const { balance } = sumTx(monthTx);

  return (
    <>
      <PageHeader title="Metas" subtitle="Dê nome ao dinheiro. Dica: crie uma chamada “Reserva de emergência” — ela conta na sua jornada." />
      <AddPanel label="Nova meta" open={list.length === 0}>
        <GoalForm />
      </AddPanel>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.length === 0 && <Empty>Nenhuma meta ainda.</Empty>}
        {list.map((g) => {
          const pct = g.targetCents ? g.currentCents / g.targetCents : 0;
          const missing = Math.max(0, g.targetCents - g.currentCents);
          let perMonth: number | null = null;
          if (g.deadline) {
            const months = Math.max(1, (g.deadline.getUTCFullYear() - new Date().getFullYear()) * 12 + g.deadline.getUTCMonth() - new Date().getMonth());
            perMonth = Math.ceil(missing / months);
          }
          const monthsAtCurrentPace = balance > 0 ? Math.ceil(missing / balance) : null;
          return (
            <Card key={g.id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-semibold">{g.name}</h3>
                <span className="num text-sm text-brand">{Math.round(pct * 100)}%</span>
              </div>
              <Progress value={pct} />
              <div className="num mt-2 text-sm">{fmtBRL(g.currentCents)} <span className="text-muted">de {fmtBRL(g.targetCents)}</span></div>
              <div className="mt-2 space-y-0.5 text-xs text-muted">
                {missing > 0 ? <div>Faltam <span className="num text-ink">{fmtBRL(missing)}</span></div> : <div className="text-up">Meta batida! 🎉</div>}
                {perMonth !== null && missing > 0 && <div>Para o prazo ({g.deadline!.toLocaleDateString("pt-BR", { timeZone: "UTC" })}): <span className="num text-ink">{fmtBRL(perMonth)}/mês</span></div>}
                {monthsAtCurrentPace !== null && missing > 0 && <div>Guardando toda a sobra deste mês: ~{monthsAtCurrentPace} meses</div>}
              </div>
              <div className="mt-4"><DepositForm id={g.id} /></div>
              <details className="mt-3">
                <summary className="text-xs text-muted hover:text-ink">Editar</summary>
                <div className="mt-3"><GoalForm g={g} /></div>
                <div className="mt-2 text-right"><DeleteButton kind="goal" id={g.id} /></div>
              </details>
            </Card>
          );
        })}
      </div>
    </>
  );
}
