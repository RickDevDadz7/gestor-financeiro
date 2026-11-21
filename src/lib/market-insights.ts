// Leitura do mercado em linguagem simples (sem IA). Puro: roda no servidor ou no cliente.

export type Quote = {
  symbol: string;
  name: string;
  priceBRL: number;
  changePct: number | null; // variação no dia
  source: string;
};

export type Indicators = {
  selic: number | null; // % a.a.
  cdi: number | null; // % a.a.
  ipca12m: number | null; // %
};

export type MarketData = {
  fetchedAt: string;
  ibovespa: Quote | null;
  fx: Quote[]; // USD, EUR
  crypto: Quote[];
  stocks: Quote[];
  indicators: Indicators;
};

export type Mood = "forte-alta" | "alta" | "lateral" | "queda" | "forte-queda";

export const MOOD: Record<Mood, { label: string; emoji: string; tone: "up" | "down" | "muted" }> = {
  "forte-alta": { label: "Dia forte de alta", emoji: "🚀", tone: "up" },
  alta: { label: "Dia positivo", emoji: "📈", tone: "up" },
  lateral: { label: "Dia de lado", emoji: "➖", tone: "muted" },
  queda: { label: "Dia negativo", emoji: "📉", tone: "down" },
  "forte-queda": { label: "Dia de queda forte", emoji: "🔻", tone: "down" },
};

const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2).replace(".", ",")}%`);
const one = (n: number) => n.toFixed(1).replace(".", ",");
const two = (n: number) => n.toFixed(2).replace(".", ",");

export function analyzeMarket(m: MarketData) {
  const all = [m.ibovespa, ...m.fx, ...m.crypto, ...m.stocks].filter(
    (q): q is Quote => !!q && q.changePct !== null,
  );
  const risk = [m.ibovespa, ...m.crypto, ...m.stocks].filter((q): q is Quote => !!q && q.changePct !== null);
  const up = risk.filter((q) => q.changePct! > 0).length;
  const down = risk.filter((q) => q.changePct! < 0).length;
  const avg = risk.length ? risk.reduce((a, q) => a + q.changePct!, 0) / risk.length : 0;
  const ibov = m.ibovespa?.changePct ?? avg;

  const mood: Mood = ibov >= 1.5 ? "forte-alta" : ibov >= 0.3 ? "alta" : ibov > -0.3 ? "lateral" : ibov > -1.5 ? "queda" : "forte-queda";

  const assets = [...m.stocks, ...m.crypto].filter((q) => q.changePct !== null);
  const sorted = [...assets].sort((a, b) => b.changePct! - a.changePct!);
  const best = sorted[0] ?? null;
  const worst = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  const { selic, ipca12m } = m.indicators;
  const realRate = selic !== null && ipca12m !== null ? ((1 + selic / 100) / (1 + ipca12m / 100) - 1) * 100 : null;

  const usd = m.fx.find((f) => f.symbol === "USD") ?? null;
  const eur = m.fx.find((f) => f.symbol === "EUR") ?? null;
  const cryptoAvg = m.crypto.length ? m.crypto.reduce((a, c) => a + (c.changePct ?? 0), 0) / m.crypto.length : null;

  const headline =
    `${MOOD[mood].emoji} ${MOOD[mood].label}` +
    (m.ibovespa ? `: Ibovespa ${pct(m.ibovespa.changePct)}` : "") +
    (risk.length ? ` · ${up} em alta, ${down} em queda` : "") +
    ".";

  const takeaways: string[] = [];
  if (best && best.changePct! > 0) takeaways.push(`Melhor do dia: ${label(best)} (${pct(best.changePct)}).`);
  if (worst && worst.changePct! < 0) takeaways.push(`Pior do dia: ${label(worst)} (${pct(worst.changePct)}).`);
  if (best && best.changePct! <= 0 && worst) takeaways.push(`Nenhum ativo acompanhado subiu hoje. O que menos caiu foi ${label(best)} (${pct(best.changePct)}).`);
  if (cryptoAvg !== null && Math.abs(cryptoAvg) >= 3)
    takeaways.push(`Cripto ${cryptoAvg > 0 ? "disparou" : "caiu forte"} (média ${pct(cryptoAvg)}). Volatilidade assim é normal nessa classe: mantenha uma fatia pequena e não decida no impulso.`);
  if (usd?.changePct !== null && usd && Math.abs(usd.changePct!) >= 0.8)
    takeaways.push(`Dólar ${usd.changePct! > 0 ? "subiu" : "caiu"} ${pct(usd.changePct)}. ${usd.changePct! > 0 ? "Ativos no exterior se valorizam em reais." : "Bom momento relativo para quem compra moeda aos poucos."}`);
  if (eur)
    takeaways.push(`Euro a R$ ${eur.priceBRL.toFixed(2).replace(".", ",")}. Para planos na Europa, comprar aos poucos todo mês dilui o risco do câmbio.`);
  if (realRate !== null)
    takeaways.push(
      `Juro real de ~${one(realRate)}% ao ano (Selic ${two(selic!)}% − inflação ${two(ipca12m!)}%). ` +
        (realRate > 5
          ? "Renda fixa pós-fixada (Tesouro Selic, CDB 100% CDI) segue pagando muito bem com risco baixo."
          : realRate > 3
            ? "Renda fixa ainda é atrativa, mas diversificar começa a fazer mais sentido."
            : "Juro real baixo favorece diversificar em ações e ativos reais."),
    );

  return { mood, up, down, best, worst, realRate, usd, eur, headline, takeaways };
}

function label(q: Quote) {
  return q.symbol.length > 6 ? q.name : q.symbol;
}
