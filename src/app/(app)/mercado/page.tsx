import { requireUser } from "@/lib/auth";
import { recentSnapshots } from "@/lib/data";
import { marketOverview, type MarketData, type Quote } from "@/lib/market";
import { fmtNumber } from "@/lib/money";
import { Card, Change, Disclaimer, Empty, PageHeader } from "@/components/ui";
import { MarketBrief } from "@/components/market-brief";
import { generateNow } from "./actions";

export default async function Mercado() {
  await requireUser();
  const [m, history] = await Promise.all([marketOverview(), recentSnapshots(10)]);
  const today = history[0];
  const saved = (today?.data as MarketData | undefined)?.indicators;
  const selic = m.indicators.selic ?? saved?.selic ?? null;
  const cdi = m.indicators.cdi ?? saved?.cdi ?? null;
  const ipca12m = m.indicators.ipca12m ?? saved?.ipca12m ?? null;
  const realRate = selic !== null && ipca12m !== null ? ((1 + selic / 100) / (1 + ipca12m / 100) - 1) * 100 : null;

  return (
    <>
      <PageHeader title="Mercado" subtitle="Bolsa, câmbio, cripto e juros, traduzidos pra decisão." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title={today ? `Resumo de ${today.day.split("-").reverse().join("/")}` : "Resumo de agora"}
          action={
            <form action={generateNow}>
              <button className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-ink">⚡ Atualizar</button>
            </form>
          }
          className="lg:col-span-2"
        >
          {today ? (
            <MarketBrief data={today.data as MarketData} summary={today.summary} />
          ) : (
            <MarketBrief data={m} summary="" />
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Juros e inflação">
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Rate label="Selic" v={selic} />
              <Rate label="CDI" v={cdi} />
              <Rate label="IPCA 12m" v={ipca12m} />
            </dl>
            {realRate !== null && (
              <div className="mt-3 rounded-xl bg-brand/10 p-3 text-center">
                <div className="text-[11px] text-muted">Juro real (acima da inflação)</div>
                <div className="num text-xl font-bold text-brand">{fmtNumber(realRate, 1)}% a.a.</div>
              </div>
            )}
          </Card>

          <Card title="Cripto">
            <QuoteList list={m.crypto.length ? m.crypto : ((today?.data as MarketData | undefined)?.crypto ?? [])} />
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Ações e ETFs acompanhados" className="lg:col-span-2">
          <QuoteList list={m.stocks} grid />
          {m.stocks.length === 0 && (
            <p className="text-xs text-muted">Sem dados da B3. Configure BRAPI_TOKEN (token grátis em brapi.dev).</p>
          )}
        </Card>
        <Card title="Resumos anteriores">
          {history.length <= 1 ? (
            <Empty>O histórico aparece com o passar dos dias.</Empty>
          ) : (
            <ul className="space-y-2">
              {history.slice(1).map((s) => (
                <li key={s.id}>
                  <details>
                    <summary className="text-sm text-muted hover:text-ink">{s.day.split("-").reverse().join("/")}</summary>
                    <div className="mt-2">
                      <MarketBrief data={s.data as MarketData} summary={s.summary} compact />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Disclaimer />
    </>
  );
}

function Rate({ label, v }: { label: string; v: number | null }) {
  return (
    <div className="rounded-xl bg-panel-2 py-2.5">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="num text-base font-semibold">{v !== null ? `${fmtNumber(v)}%` : "—"}</dd>
    </div>
  );
}

function QuoteList({ list, grid }: { list: Quote[]; grid?: boolean }) {
  if (!list.length) return <Empty>Sem dados no momento.</Empty>;
  return (
    <ul className={grid ? "grid gap-x-6 sm:grid-cols-2" : ""}>
      {list.map((q) => (
        <li key={q.symbol} className="flex items-center justify-between gap-3 border-b border-line/60 py-2.5 text-sm last:border-0">
          <div className="min-w-0">
            <div className="font-medium">{q.symbol.length > 6 ? q.name : q.symbol}</div>
            {q.symbol.length <= 6 && <div className="truncate text-xs text-muted">{q.name}</div>}
          </div>
          <div className="shrink-0 text-right">
            <div className="num">R$ {fmtNumber(q.priceBRL, q.priceBRL > 1000 ? 0 : 2)}</div>
            <Change pct={q.changePct} className="text-xs" />
          </div>
        </li>
      ))}
    </ul>
  );
}
