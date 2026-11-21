import { NextResponse, type NextRequest } from "next/server";
import { generateDailyBrief } from "@/lib/brief";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Chamado todo dia pelo Vercel Cron (vercel.json) ou por qualquer agendador
 * (GitHub Actions, cron-job.org) com o header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = await generateDailyBrief();
  return NextResponse.json({ ok: true, day: r.day, summary: r.summary });
}
