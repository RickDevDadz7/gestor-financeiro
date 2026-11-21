import "server-only";
import { analyzeMarket } from "./market-insights";
export type { Quote, MarketData, Indicators } from "./market-insights";
// Cotações de fontes gratuitas:
// - CoinGecko (cripto)            https://www.coingecko.com/api
// - brapi.dev (B3: ações, FIIs)   https://brapi.dev  (token grátis em BRAPI_TOKEN)
// - AwesomeAPI (câmbio)           https://docs.awesomeapi.com.br
// - Banco Central SGS (Selic/CDI/IPCA)

import type { Quote, MarketData, Indicators } from "./market-insights";

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
      name: id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
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
  if (data && Object.keys(data).length) {
    return Object.entries(data).map(([k, v]) => ({
      symbol: k.replace("BRL", ""),
      name: k.startsWith("USD") ? "Dólar" : k.startsWith("EUR") ? "Euro" : k,
      priceBRL: Number(v.bid),
      changePct: Number(v.pctChange),
      source: "AwesomeAPI",
    }));
  }
  // Reserva: PTAX do Banco Central (diária, calcula a variação com o dia anterior)
  const ptax = async (code: number, symbol: string, name: string): Promise<Quote | null> => {
    const rows = await getJSON<{ valor: string }[]>(
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/2?formato=json`,
      3600,
    );
    if (!rows?.length) return null;
    const last = Number(rows[rows.length - 1].valor);
    const prev = rows.length > 1 ? Number(rows[0].valor) : null;
    return {
      symbol,
      name,
      priceBRL: last,
      changePct: prev ? ((last - prev) / prev) * 100 : null,
      source: "Banco Central (PTAX)",
    };
  };
  const r = await Promise.all([ptax(1, "USD", "Dólar"), ptax(21619, "EUR", "Euro")]);
  return r.filter((q): q is Quote => q !== null);
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
  const a = analyzeMarket(m);
  return [a.headline, ...a.takeaways].join("\n");
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
