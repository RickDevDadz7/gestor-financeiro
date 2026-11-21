import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { byCategory, getMonthTx, sumTx } from "@/lib/data";
import { fmtBRL, monthLabel, monthRange, shiftMonth } from "@/lib/money";
import { AddPanel, Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { CopyRecurringButton, DeleteButton, TransactionForm } from "@/components/forms";

export default async function Transacoes({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { userId } = await requireUser();
  const { m } = await searchParams;
  const { ym } = monthRange(m && /^\d{4}-\d{2}$/.test(m) ? m : undefined);
  const list = await getMonthTx(userId, ym);
  const { income, expense, balance } = sumTx(list);
  const cats = byCategory(list);

  return (
    <>
      <PageHeader title="Receitas e gastos" subtitle="Tudo que entra e sai. Lance na hora, leva 10 segundos.">
        <Link scroll={false} href={`?m=${shiftMonth(ym, -1)}`} className="btn-ghost">‹</Link>
        <span className="min-w-36 text-center text-sm capitalize">{monthLabel(ym)}</span>
        <Link scroll={false} href={`?m=${shiftMonth(ym, 1)}`} className="btn-ghost">›</Link>
      </PageHeader>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Entradas" cents={income} tone="up" />
        <Stat label="Saídas" cents={expense} tone="down" />
        <Stat label="Saldo" cents={balance} tone="auto" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <AddPanel label="Novo lançamento" open={list.length === 0}>
            <TransactionForm />
          </AddPanel>

          <Card title={`Lançamentos (${list.length})`} action={<CopyRecurringButton ym={ym} />}>
            {list.length === 0 ? (
              <Empty>Nada lançado em {monthLabel(ym)}.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {list.map((t) => (
                  <li key={t.id}>
                    <details>
                      <summary className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{t.description}</span>
                            {t.recurring && <Badge>fixo</Badge>}
                          </div>
                          <div className="text-xs text-muted">
                            {t.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })} · {t.category}
                          </div>
                        </div>
                        <span className={`num shrink-0 text-sm font-semibold ${t.type === "INCOME" ? "text-up" : "text-down"}`}>
                          {t.type === "INCOME" ? "+" : "−"} {fmtBRL(t.amountCents)}
                        </span>
                      </summary>
                      <div className="mb-3 rounded-xl bg-panel-2 p-3">
                        <TransactionForm tx={t} />
                        <div className="mt-2 text-right"><DeleteButton kind="tx" id={t.id} /></div>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Por categoria">
          {cats.length === 0 ? (
            <Empty>Sem despesas.</Empty>
          ) : (
            <ul className="space-y-3">
              {cats.map((c) => (
                <li key={c.category}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{c.category}</span>
                    <span className="num">{fmtBRL(c.cents)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${(c.cents / expense) * 100}%` }} />
                  </div>
                  <div className="mt-0.5 text-right text-[11px] text-muted">
                    {Math.round((c.cents / expense) * 100)}% dos gastos{income ? ` · ${Math.round((c.cents / income) * 100)}% da renda` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
