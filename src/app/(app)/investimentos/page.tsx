import { requireUser } from "@/lib/auth";
import { getValuedHoldings, journeyInput, KIND_LABEL } from "@/lib/data";
import { buildJourney } from "@/lib/journey";
import { fmtBRL, fmtNumber } from "@/lib/money";
import { indicators } from "@/lib/market";
import { AddPanel, Card, Change, Disclaimer, Empty, PageHeader, Stat } from "@/components/ui";
import { DeleteButton, HoldingForm } from "@/components/forms";
import { AllocationPie } from "@/components/charts";

// Alocação de referência para quem está começando (didática, não recomendação)
const REFERENCE = [
  { kind: "Renda fixa", pct: 50, why: "Base segura: reserva + Tesouro/CDB. Com juro real alto no Brasil, é o alicerce." },
  { kind: "Ações BR + FIIs", pct: 25, why: "Crescimento e renda passiva (dividendos/aluguéis) no longo prazo." },
  { kind: "Exterior", pct: 15, why: "Proteção contra o real e acesso a empresas globais (IVVB11, BDRs, ETFs). Útil pra quem quer sair do país." },
  { kind: "Cripto", pct: 10, why: "Parte pequena, alta volatilidade. Prefira BTC/ETH e nunca mais do que aceita perder." },
];

export default async function Investimentos() {
  const { userId } = await requireUser();
  const [valued, ind] = await Promise.all([getValuedHoldings(userId), indicators()]);
  const ji = await journeyInput(userId, { valued });
  const { current } = buildJourney(ji);

  const total = valued.reduce((a, b) => a + b.valueCents, 0);
  const cost = valued.reduce((a, b) => a + b.costCents, 0);
  const pnl = total - cost;

  const byKind = new Map<string, number>();
  for (const h of valued) byKind.set(KIND_LABEL[h.kind], (byKind.get(KIND_LABEL[h.kind]) ?? 0) + h.valueCents);
  const alloc = [...byKind.entries()].map(([name, v]) => ({ name, value: v / 100 }));

  const pctOf = (labels: string[]) => (total ? (labels.reduce((a, l) => a + (byKind.get(l) ?? 0), 0) / total) * 100 : 0);
  const actual: Record<string, number> = {
    "Renda fixa": pctOf(["Renda fixa"]),
    "Ações BR + FIIs": pctOf(["Ações BR", "FIIs", "ETFs"]),
    Exterior: pctOf(["Exterior"]),
    Cripto: pctOf(["Cripto"]),
  };

  const realRate = ind.selic !== null && ind.ipca12m !== null ? ((1 + ind.selic / 100) / (1 + ind.ipca12m / 100) - 1) * 100 : null;
  const blockedByDebt = ji.expensiveDebtCents > 0;
  const noReserve = ji.liquidReserveCents < Math.max(ji.avgMonthlyExpenseCents, ji.monthExpenseCents) * 3;

  return (
    <>
      <PageHeader title="Investimentos" subtitle="Ações, FIIs, cripto e renda fixa com cotação automática." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Patrimônio investido" cents={total} />
        <Stat label="Total aplicado" cents={cost} />
        <Stat label="Resultado" cents={pnl} tone="auto" hint={cost ? `${fmtNumber((pnl / cost) * 100)}%` : undefined} />
        <div className="rounded-2xl border border-line bg-panel p-4">
          <div className="text-xs text-muted">Selic · IPCA 12m</div>
          <div className="num mt-1 text-lg font-semibold">
            {ind.selic !== null ? `${fmtNumber(ind.selic)}%` : "—"} · {ind.ipca12m !== null ? `${fmtNumber(ind.ipca12m)}%` : "—"}
          </div>
          {realRate !== null && <div className="text-xs text-muted">juro real ≈ {fmtNumber(realRate, 1)}% a.a.</div>}
        </div>
      </div>

      {(blockedByDebt || noReserve) && (
        <div className="mt-4 rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm">
          <div className="font-semibold text-warn">Antes de investir em renda variável</div>
          <p className="mt-1 text-muted">
            {blockedByDebt
              ? "Você ainda tem dívidas com juros acima de 1% ao mês. Quitar essas dívidas é um “investimento” com retorno garantido maior do que qualquer ação."
              : "Sua reserva de emergência ainda está abaixo de 3 meses de gastos. Construa ela em renda fixa com liquidez diária primeiro."}{" "}
            Sua etapa atual: <span className="text-ink">{current.title}</span>.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <AddPanel label="Adicionar ativo" open={valued.length === 0}>
            <HoldingForm />
          </AddPanel>

          <Card title="Carteira">
            {valued.length === 0 ? (
              <Empty>Nenhum ativo ainda. Comece pela renda fixa (ex: “Tesouro Selic”, valor atual manual).</Empty>
            ) : (
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-xs text-muted">
                    <tr className="border-b border-line text-left">
                      <th className="px-4 py-2 font-medium sm:px-2">Ativo</th>
                      <th className="px-2 py-2 text-right font-medium">Cotação</th>
                      <th className="px-2 py-2 text-right font-medium">Dia</th>
                      <th className="px-2 py-2 text-right font-medium">Valor</th>
                      <th className="px-2 py-2 text-right font-medium">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valued.map((h) => (
                      <tr key={h.id} className="border-b border-line/60 align-top">
                        <td className="px-4 py-2.5 sm:px-2">
                          <details>
                            <summary>
                              <div className="font-medium">{h.kind === "CRYPTO" ? h.ticker : h.ticker.toUpperCase()}</div>
                              <div className="text-xs text-muted">{KIND_LABEL[h.kind]} · {fmtNumber(h.quantity, h.kind === "CRYPTO" ? 6 : 0)} un.</div>
                            </summary>
                            <div className="mt-3 w-[min(80vw,520px)] rounded-xl bg-panel-2 p-3">
                              <HoldingForm h={h} />
                              <div className="mt-2 text-right"><DeleteButton kind="holding" id={h.id} /></div>
                            </div>
                          </details>
                        </td>
                        <td className="num px-2 py-2.5 text-right">{h.priceCents !== null ? fmtBRL(h.priceCents) : <span className="text-muted">manual</span>}</td>
                        <td className="px-2 py-2.5 text-right"><Change pct={h.dayChangePct} /></td>
                        <td className="num px-2 py-2.5 text-right">{fmtBRL(h.valueCents)}</td>
                        <td className="px-2 py-2.5 text-right">
                          <div className={`num ${h.pnlCents >= 0 ? "text-up" : "text-down"}`}>{fmtBRL(h.pnlCents)}</div>
                          <Change pct={h.pnlPct} className="text-xs" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] text-muted">
              Cotações: B3 via brapi.dev, cripto via CoinGecko (use o id: bitcoin, ethereum, solana…). Atualiza a cada 5 min.
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Alocação atual">
            {alloc.length ? <AllocationPie data={alloc} /> : <Empty>Sem dados.</Empty>}
          </Card>

          <Card title="Referência para iniciantes">
            <ul className="space-y-3">
              {REFERENCE.map((r) => (
                <li key={r.kind}>
                  <div className="flex justify-between text-sm">
                    <span>{r.kind}</span>
                    <span className="num text-muted">
                      {total ? <span className={Math.abs(actual[r.kind] - r.pct) > 10 ? "text-warn" : "text-ink"}>{Math.round(actual[r.kind])}%</span> : "—"} / {r.pct}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{r.why}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted">Atual / referência. É um ponto de partida didático: ajuste ao seu perfil e prazo.</p>
          </Card>
        </div>
      </div>
      <Disclaimer />
    </>
  );
}
