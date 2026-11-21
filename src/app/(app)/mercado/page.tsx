import { requireUser } from "@/lib/auth";
import { recentSnapshots } from "@/lib/data";
import { marketOverview, type Quote } from "@/lib/market";
import { fmtNumber } from "@/lib/money";
import { Card, Change, Disclaimer, Empty, PageHeader } from "@/components/ui";
import { generateNow } from "./actions";

export default async function Mercado() {
  await requireUser();
  const [m, history] = await Promise.all([marketOverview(), recentSnapshots(10)]);
  const today = history[0];

  return (
    <>
      <PageHeader title="Mercado" subtitle="Bolsa, câmbio, cripto e juros — atualizado a cada 5 minutos.">
        <form action={generateNow}>
          <button className="btn-ghost">⚡ Gerar resumo agora</button>
        </form>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Big label="Ibovespa" value={m.ibovespa ? `${fmtNumber(m.ibovespa.priceBRL, 0)} pts` : "—"} change={m.ibovespa?.changePct ?? null} />
        {m.fx.map((f) => (
          <Big key={f.symbol} label={f.symbol === "USD" ? "Dólar" : f.symbol === "EUR" ? "Euro" : f.symbol} value={`R$ ${fmtNumber(f.priceBRL, 3)}`} change={f.changePct} />
        ))}
        <Big label="Selic / CDI" value={m.indicators.selic !== null ? `${fmtNumber(m.indicators.selic)}%` : "—"} sub={m.indicators.cdi !== null ? `CDI ${fmtNumber(m.indicators.cdi)}% a.a.` : undefined} change={null} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title={today ? `Resumo do dia · ${today.day.split("-").reverse().join("/")}` : "Resumo do dia"} className="lg:col-span-2">
          {today ? <p className="whitespace-pre-line text-sm leading-relaxed">{today.summary}</p> : <Empty>Ainda sem resumo. Clique em “Gerar resumo agora”.</Empty>}
        </Card>
        <Card title="Cripto">
          <QuoteList list={m.crypto} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Ações e ETFs acompanhados" className="lg:col-span-2">
          <QuoteList list={m.stocks} grid />
          {m.stocks.length === 0 && (
            <p className="text-xs text-muted">Sem dados da B3. Configure BRAPI_TOKEN no .env (token grátis em brapi.dev).</p>
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
                    <p className="mt-2 whitespace-pre-line text-xs leading-relaxed">{s.summary}</p>
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

function Big({ label, value, change, sub }: { label: string; value: string; change: number | null; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-1 text-lg font-semibold">{value}</div>
      {sub ? <div className="text-xs text-muted">{sub}</div> : <Change pct={change} className="text-xs" />}
    </div>
  );
}

function QuoteList({ list, grid }: { list: Quote[]; grid?: boolean }) {
  if (!list.length) return <Empty>Sem dados no momento.</Empty>;
  return (
    <ul className={grid ? "grid gap-x-6 sm:grid-cols-2" : ""}>
      {list.map((q) => (
        <li key={q.symbol} className="flex items-center justify-between border-b border-line/60 py-2 text-sm last:border-0">
          <div>
            <div className="font-medium">{q.symbol.length > 6 ? q.name : q.symbol}</div>
            {q.symbol.length <= 6 && <div className="max-w-40 truncate text-xs text-muted">{q.name}</div>}
          </div>
          <div className="text-right">
            <div className="num">R$ {fmtNumber(q.priceBRL, q.priceBRL > 1000 ? 0 : 2)}</div>
            <Change pct={q.changePct} className="text-xs" />
          </div>
        </li>
      ))}
    </ul>
  );
}
