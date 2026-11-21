import "server-only";
import { sql } from "drizzle-orm";
import { db, marketSnapshots } from "@/db";
import { aiSummary, marketOverview, ruleBasedSummary } from "./market";
import { todayBR } from "./money";

/** Busca o mercado, escreve o resumo e salva a foto do dia (substitui se já existir) */
export async function generateDailyBrief() {
  const data = await marketOverview();
  const summary = (await aiSummary(data)) ?? ruleBasedSummary(data);
  const day = todayBR();
  await db
    .insert(marketSnapshots)
    .values({ day, data, summary })
    .onConflictDoUpdate({ target: marketSnapshots.day, set: { data, summary, createdAt: sql`now()` } });
  return { day, summary, data };
}
