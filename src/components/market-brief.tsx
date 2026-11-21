import { analyzeMarket, MOOD, type MarketData, type Quote } from "@/lib/market-insights";
import { Change } from "./ui";

const brl = (n: number, d = 2) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

function Tile({ label, value, change }: { label: string; value: string; change: number | null }) {
  return (
    <div className="rounded-xl bg-panel-2 px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="num mt-0.5 truncate text-sm font-semibold">{value}</div>
      <Change pct={change} className="text-xs" />
    </div>
  );
}

function short(q: Quote) {
  return q.symbol.length > 6 ? q.name : q.symbol;
}

/** Resumo do mercado em formato visual (cards), a partir da foto do dia */
export function MarketBrief({ data, summary, compact = false }: { data: MarketData; summary: string; compact?: boolean }) {
  const a = analyzeMarket(data);
  const mood = MOOD[a.mood];
  const moodCls = mood.tone === "up" ? "bg-up/10 text-up border-up/30" : mood.tone === "down" ? "bg-down/10 text-down border-down/30" : "bg-panel-2 text-ink border-line";

  const tiles: { label: string; value: string; change: number | null }[] = [];
  if (data.ibovespa) tiles.push({ label: "Ibovespa", value: `${brl(data.ibovespa.priceBRL, 0)} pts`, change: data.ibovespa.changePct });
  if (a.usd) tiles.push({ label: "Dólar", value: `R$ ${brl(a.usd.priceBRL, 2)}`, change: a.usd.changePct });
  if (a.eur) tiles.push({ label: "Euro", value: `R$ ${brl(a.eur.priceBRL, 2)}`, change: a.eur.changePct });
  for (const c of data.crypto.slice(0, compact ? 1 : 3))
    tiles.push({ label: c.name, value: `R$ ${brl(c.priceBRL, c.priceBRL > 1000 ? 0 : 2)}`, change: c.changePct });

  // Se o resumo foi escrito pelo Claude, ele é diferente do texto por regras
  const isAI = !summary.startsWith(mood.emoji);

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${moodCls}`}>
        <span className="text-2xl leading-none">{mood.emoji}</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{mood.label}</div>
          <div className="text-xs opacity-80">
            {a.up} em alta · {a.down} em queda
          </div>
        </div>
      </div>

      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {tiles.slice(0, compact ? 4 : 6).map((t) => (
          <Tile key={t.label} {...t} />
        ))}
      </div>

      {!compact && (a.best || a.worst) && (
        <div className="grid grid-cols-2 gap-2">
          {a.best && (
            <div className="rounded-xl border border-line px-3 py-2.5">
              <div className="text-[11px] text-muted">{a.best.changePct! > 0 ? "▲ Melhor do dia" : "Menor queda"}</div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">{short(a.best)}</span>
                <Change pct={a.best.changePct} className="text-xs" />
              </div>
            </div>
          )}
          {a.worst && (
            <div className="rounded-xl border border-line px-3 py-2.5">
              <div className="text-[11px] text-muted">▼ Pior do dia</div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">{short(a.worst)}</span>
                <Change pct={a.worst.changePct} className="text-xs" />
              </div>
            </div>
          )}
        </div>
      )}

      {!compact && (
        <div className="rounded-xl bg-panel-2 p-3">
          <div className="mb-2 text-xs font-semibold text-brand">O que isso significa pra você</div>
          {isAI ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">{summary}</p>
          ) : (
            <ul className="space-y-2">
              {a.takeaways
                .filter((t) => !t.startsWith("Melhor") && !t.startsWith("Pior"))
                .map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink/90">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <span>{t}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
