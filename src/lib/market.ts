import "server-only";
// Cotações de fontes gratuitas:
// - CoinGecko (cripto)            https://www.coingecko.com/api
// - brapi.dev (B3: ações, FIIs)   https://brapi.dev  (token grátis em BRAPI_TOKEN)
// - AwesomeAPI (câmbio)           https://docs.awesomeapi.com.br
// - Banco Central SGS (Selic/CDI/IPCA)

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

const REVALIDATE = 300; // 5 min de cache

async function getJSON<T>(url: string, revalidate = REVALIDATE): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate },
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type CoinGeckoResp = Record<string, { brl?: number; brl_24h_change?: number }>;

export async function cryptoQuotes(ids: string[]): Promise<Quote[]> {
  const clean = [...new Set(ids.map((s) => s.trim().toLowerCase()).filter(Boolean))];
  if (!clean.length) return [];
  const data = await getJSON<CoinGeckoResp>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(clean.join(","))}&vs_currencies=brl&include_24hr_change=true`,
  );
  if (!data) return [];
  return clean
    .filter((id) => data[id]?.brl !== undefined)
    .map((id) => ({
      symbol: id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      priceBRL: data[id].brl!,
      changePct: data[id].brl_24h_change ?? null,
      source: "CoinGecko",
    }));
}

type BrapiResp = {
  results?: {
    symbol: string;
    shortName?: string;
    longName?: string;
    regularMarketPrice?: number;
    regularMarketChangePercent?: number;
  }[];
};

/** Plano grátis da brapi aceita 1 ativo por requisição — buscamos em paralelo. */
export async function b3Quotes(tickers: string[]): Promise<Quote[]> {
  const clean = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))];
  const token = process.env.BRAPI_TOKEN ? `?token=${process.env.BRAPI_TOKEN}` : "";
  const results = await Promise.all(
    clean.map((t) =>
      getJSON<BrapiResp>(`https://brapi.dev/api/quote/${encodeURIComponent(t)}${token}`),
    ),
  );
  return results.flatMap((r) =>
    (r?.results ?? [])
      .filter((q) => typeof q.regularMarketPrice === "number")
      .map((q) => ({
        symbol: q.symbol,
        name: q.shortName ?? q.longName ?? q.symbol,
        priceBRL: q.regularMarketPrice!,
        changePct: q.regularMarketChangePercent ?? null,
        source: "brapi",
      })),
  );
}

type AwesomeResp = Record<string, { bid: string; pctChange: string; name: string }>;

export async function fxQuotes(): Promise<Quote[]> {
  const data = await getJSON<AwesomeResp>(
    "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL",
  );
  if (!data) return [];
  return Object.entries(data).map(([k, v]) => ({
    symbol: k.replace("BRL", ""),
    name: v.name?.split("/")[0] ?? k,
    priceBRL: Number(v.bid),
    changePct: Number(v.pctChange),
    source: "AwesomeAPI",
  }));
}

async function sgs(code: number): Promise<number | null> {
  const data = await getJSON<{ data: string; valor: string }[]>(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`,
    3600,
  );
  const v = data?.[0]?.valor;
  return v ? Number(v.replace(",", ".")) : null;
}

export async function indicators(): Promise<Indicators> {
  const [selic, cdi, ipca12m] = await Promise.all([sgs(432), sgs(4389), sgs(13522)]);
  return { selic, cdi, ipca12m };
}

export function watchlist() {
  return {
    stocks: (process.env.WATCH_STOCKS ?? "PETR4,VALE3,ITUB4,BBAS3,WEGE3,BOVA11,IVVB11").split(","),
    crypto: (process.env.WATCH_CRYPTO ?? "bitcoin,ethereum,solana").split(","),
  };
}

export async function marketOverview(): Promise<MarketData> {
  const w = watchlist();
  const [ibov, fx, crypto, stocks, ind] = await Promise.all([
    b3Quotes(["^BVSP"]),
    fxQuotes(),
    cryptoQuotes(w.crypto),
    b3Quotes(w.stocks),
    indicators(),
  ]);
  return {
    fetchedAt: new Date().toISOString(),
    ibovespa: ibov[0] ? { ...ibov[0], name: "Ibovespa" } : null,
    fx,
    crypto,
    stocks,
    indicators: ind,
  };
}

/** Resumo em texto sem IA — usado quando ANTHROPIC_API_KEY não está configurada */
export function ruleBasedSummary(m: MarketData): string {
  const lines: string[] = [];
  const pct = (n: number | null) =>
    n === null ? "s/ var." : `${n > 0 ? "+" : ""}${n.toFixed(2).replace(".", ",")}%`;
  const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (m.ibovespa) {
    const c = m.ibovespa.changePct ?? 0;
    const mood = c > 1 ? "dia forte" : c > 0 ? "leve alta" : c > -1 ? "leve queda" : "dia de queda forte";
    lines.push(`Ibovespa: ${m.ibovespa.priceBRL.toLocaleString("pt-BR")} pts (${pct(c)}) — ${mood}.`);
  }
  for (const f of m.fx) lines.push(`${f.symbol}: ${money(f.priceBRL)} (${pct(f.changePct)}).`);
  if (m.crypto.length)
    lines.push(
      "Cripto: " + m.crypto.map((c) => `${c.name} ${money(c.priceBRL)} (${pct(c.changePct)})`).join(" · ") + ".",
    );
  if (m.stocks.length) {
    const sorted = [...m.stocks].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    lines.push(`Destaque de alta: ${best.symbol} (${pct(best.changePct)}). Maior queda: ${worst.symbol} (${pct(worst.changePct)}).`);
  }
  const { selic, ipca12m } = m.indicators;
  if (selic !== null) {
    const real = ipca12m !== null ? ((1 + selic / 100) / (1 + ipca12m / 100) - 1) * 100 : null;
    lines.push(
      `Selic ${selic.toFixed(2).replace(".", ",")}% a.a.` +
        (ipca12m !== null ? `, IPCA 12m ${ipca12m.toFixed(2).replace(".", ",")}%` : "") +
        (real !== null ? ` → juro real ~${real.toFixed(1).replace(".", ",")}% a.a. Renda fixa pós-fixada segue ${real > 5 ? "muito atrativa" : real > 3 ? "atrativa" : "menos atrativa"}.` : "."),
    );
  }
  if (!lines.length) return "Não foi possível buscar dados do mercado hoje.";
  return lines.join("\n");
}

/** Resumo escrito pelo Claude (opcional) */
export async function aiSummary(m: MarketData): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
        max_tokens: 700,
        messages: [
          {
            role: "user",
            content:
              "Você é um analista que escreve um resumo diário do mercado para um investidor pessoa física brasileiro iniciante. " +
              "Com base APENAS nos dados abaixo, escreva em português do Brasil, em até 8 linhas curtas: " +
              "1) como foi o dia (Ibovespa, dólar, euro, cripto), 2) destaques, 3) o que isso significa para quem está construindo patrimônio aos poucos (renda fixa vs. ações vs. cripto, em termos gerais e educativos). " +
              "Não invente notícias nem números. Não dê recomendação de compra/venda de ativo específico.\n\n" +
              JSON.stringify(m),
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    return json.content?.find((c) => c.type === "text")?.text?.trim() ?? null;
  } catch {
    return null;
  }
}
