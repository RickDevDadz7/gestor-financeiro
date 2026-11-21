import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDebts, getMonthTx, sumTx } from "@/lib/data";
import { annualRate, daysUntil, nextDueDate, prioritize, severity, severityLabel, simulatePayoff, type Strategy } from "@/lib/debts";
import { fmtBRL, parseToCents } from "@/lib/money";
import { AddPanel, Badge, Card, Disclaimer, Empty, PageHeader, Stat } from "@/components/ui";
import { DebtForm, DeleteButton, PayDebtForm, SimulatorInput } from "@/components/forms";

const SEV_TONE = { critica: "down", alta: "warn", media: "muted", baixa: "up" } as const;

export default async function Dividas({ searchParams }: { searchParams: Promise<{ s?: string; extra?: string }> }) {
  const { userId } = await requireUser();
  const sp = await searchParams;
  const strategy: Strategy = sp.s === "snowball" ? "snowball" : "avalanche";
  const [all, monthTx] = await Promise.all([getDebts(userId), getMonthTx(userId)]);
  const open = all.filter((d) => !d.paidOff);
  const paid = all.filter((d) => d.paidOff);
  const ordered = prioritize(open, strategy);

  const totalBalance = open.reduce((a, b) => a + b.balanceCents, 0);
  const totalMin = open.reduce((a, b) => a + b.minPaymentCents, 0);
  const monthlyInterest = open.reduce((a, b) => a + Math.round(b.balanceCents * (b.monthlyInterestRate / 100)), 0);

  const { balance } = sumTx(monthTx);
  const extra = sp.extra !== undefined ? parseToCents(sp.extra) : Math.max(0, balance);
  const simMin = simulatePayoff(open, totalMin, strategy);
  const simExtra = simulatePayoff(open, totalMin + extra, strategy);
  const other = simulatePayoff(open, totalMin + extra, strategy === "avalanche" ? "snowball" : "avalanche");

  const years = (m: number) => (m >= 12 ? `${Math.floor(m / 12)}a ${m % 12}m` : `${m} meses`);

  return (
    <>
      <PageHeader title="Dívidas" subtitle="Liste tudo. O app diz a ordem certa de pagar e quando você fica livre." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total devido" cents={totalBalance} tone="down" />
        <Stat label="Parcelas mínimas / mês" cents={totalMin} />
        <Stat label="Juros que você paga / mês" cents={monthlyInterest} tone="down" hint="dinheiro jogado fora" />
        <Stat label="Sobra do mês p/ atacar" cents={Math.max(0, balance)} tone="up" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <AddPanel label="Adicionar dívida" open={all.length === 0}>
            <DebtForm />
          </AddPanel>

          <Card
            title="Ordem de pagamento"
            action={
              <div className="flex rounded-lg border border-line p-0.5 text-xs">
                {(["avalanche", "snowball"] as const).map((s) => (
                  <Link key={s} scroll={false} href={`?s=${s}${sp.extra !== undefined ? `&extra=${encodeURIComponent(sp.extra)}` : ""}`} className={`rounded-md px-2.5 py-1 ${strategy === s ? "bg-brand text-black" : "text-muted"}`}>
                    {s === "avalanche" ? "Avalanche" : "Bola de neve"}
                  </Link>
                ))}
              </div>
            }
          >
            <p className="mb-3 text-xs text-muted">
              {strategy === "avalanche"
                ? "Avalanche: maior juros primeiro. Matematicamente é o que mais economiza."
                : "Bola de neve: menor saldo primeiro. Vitórias rápidas que mantêm a motivação."}{" "}
              Pague o mínimo de todas e jogue toda sobra na nº 1.
            </p>
            {ordered.length === 0 ? (
              <Empty>Sem dívidas em aberto. Bora investir. 🚀</Empty>
            ) : (
              <ul className="space-y-2">
                {ordered.map((d, i) => {
                  const due = nextDueDate(d.dueDay);
                  const days = daysUntil(due);
                  const sev = severity(d.monthlyInterestRate);
                  return (
                    <li key={d.id} className={`rounded-xl border ${i === 0 ? "border-brand/60" : "border-line"} bg-panel-2/50`}>
                      <details>
                        <summary className="flex items-center gap-3 p-3">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? "bg-brand text-black" : "bg-panel-2 text-muted"}`}>{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold">{d.name}</span>
                              <Badge tone={SEV_TONE[sev]}>{severityLabel[sev]}</Badge>
                            </div>
                            <div className="text-xs text-muted">
                              {String(d.monthlyInterestRate).replace(".", ",")}% a.m. ({Math.round(annualRate(d.monthlyInterestRate))}% a.a.) · vence {due.toLocaleDateString("pt-BR")}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="num text-sm font-semibold">{fmtBRL(d.balanceCents)}</div>
                            <Badge tone={days <= 3 ? "down" : days <= 7 ? "warn" : "muted"}>{days === 0 ? "vence hoje" : `em ${days}d`}</Badge>
                          </div>
                        </summary>
                        <div className="space-y-4 border-t border-line p-3">
                          <PayDebtForm id={d.id} suggested={i === 0 ? d.minPaymentCents + extra : d.minPaymentCents} />
                          {d.notes && <p className="text-xs text-muted">📝 {d.notes}</p>}
                          <details>
                            <summary className="text-xs text-muted hover:text-ink">Editar dívida</summary>
                            <div className="mt-3"><DebtForm debt={d} /></div>
                          </details>
                          <div className="text-right"><DeleteButton kind="debt" id={d.id} /></div>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Simulador de liberdade">
            <SimulatorInput strategy={strategy} initial={(extra / 100).toFixed(2).replace(".", ",")} />
            {open.length === 0 ? (
              <Empty>Cadastre dívidas para simular.</Empty>
            ) : (
              <div className="space-y-3 text-sm">
                <Row label="Só pagando o mínimo" value={simMin.feasible ? years(simMin.months) : "nunca quita ⚠️"} sub={simMin.feasible ? `${fmtBRL(simMin.totalInterestCents)} em juros` : "o mínimo não cobre os juros"} />
                <Row label={`Com +${fmtBRL(extra)}/mês`} value={simExtra.feasible ? years(simExtra.months) : "não quita"} sub={simExtra.feasible ? `${fmtBRL(simExtra.totalInterestCents)} em juros` : ""} highlight />
                {simMin.feasible && simExtra.feasible && simMin.totalInterestCents > simExtra.totalInterestCents && (
                  <p className="rounded-lg bg-brand/10 p-3 text-xs text-brand">
                    Você economiza {fmtBRL(simMin.totalInterestCents - simExtra.totalInterestCents)} e fica livre {simMin.months - simExtra.months} meses antes.
                  </p>
                )}
                {other.feasible && simExtra.feasible && (
                  <p className="text-xs text-muted">
                    Pelo método {strategy === "avalanche" ? "bola de neve" : "avalanche"} seriam {years(other.months)} e {fmtBRL(other.totalInterestCents)} em juros.
                  </p>
                )}
                {simExtra.order.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs text-muted">Linha do tempo</div>
                    <ol className="space-y-1 text-xs">
                      {simExtra.order.map((o) => (
                        <li key={o.id} className="flex justify-between"><span>✓ {o.name}</span><span className="num text-muted">mês {o.paidOffMonth}</span></li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title="Dicas rápidas">
            <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted">
              <li>Cartão rotativo e cheque especial são os piores (podem passar de 400% ao ano). Ataque primeiro.</li>
              <li>Trocar dívida cara por uma barata (consignado, portabilidade) já é uma vitória.</li>
              <li>Feirões de renegociação (Serasa, Desenrola, bancos) costumam dar descontos grandes à vista.</li>
              <li>Não invista em renda variável enquanto tiver dívida acima de ~1% ao mês.</li>
            </ul>
          </Card>

          {paid.length > 0 && (
            <Card title={`Quitadas (${paid.length}) 🏆`}>
              <ul className="space-y-1 text-sm">
                {paid.map((d) => (
                  <li key={d.id} className="flex justify-between text-muted"><span className="line-through">{d.name}</span><DeleteButton kind="debt" id={d.id} /></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      <Disclaimer />
    </>
  );
}

function Row({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-panel-2" : ""}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-base font-semibold ${highlight ? "text-brand" : ""}`}>{value}</div>
      {sub && <div className="num text-xs text-muted">{sub}</div>}
    </div>
  );
}
