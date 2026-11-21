import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, customSheets } from "@/db";
import { requireUser } from "@/lib/auth";
import { buildAutoSheets } from "@/lib/auto-sheets";
import { Card, Empty, PageHeader } from "@/components/ui";
import { DataTable } from "@/components/data-table";
import { createSheet } from "@/app/actions";

export default async function Planilhas({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { userId } = await requireUser();
  const { aba } = await searchParams;
  const [sheets, custom] = await Promise.all([
    buildAutoSheets(userId),
    db.select().from(customSheets).where(eq(customSheets.userId, userId)).orderBy(desc(customSheets.updatedAt)),
  ]);
  const active = sheets.find((s) => s.key === aba) ?? sheets[0];

  async function newSheet(f: FormData) {
    "use server";
    await createSheet(String(f.get("name") ?? ""));
  }

  return (
    <>
      <PageHeader title="Planilhas" subtitle="Excel automático: se monta sozinho com seus dados. Exporte quando quiser.">
        <a href="/api/export" className="btn">⬇ Baixar .xlsx</a>
      </PageHeader>

      <div className="-mx-4 mb-3 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {sheets.map((s) => (
          <Link
            key={s.key}
            href={`?aba=${s.key}`}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${s.key === active.key ? "bg-brand text-black" : "bg-panel text-muted hover:text-ink"}`}
          >
            {s.name}
          </Link>
        ))}
      </div>
      <p className="mb-3 text-xs text-muted">{active.description}</p>
      <DataTable sheet={active} />

      <Card title="Minhas planilhas livres" className="mt-6">
        <p className="mb-3 text-xs text-muted">
          Monte o que quiser com fórmulas: <code className="text-ink">=SOMA(B2:B10)</code>, <code className="text-ink">=MEDIA()</code>,{" "}
          <code className="text-ink">=SE(B2&gt;1000;&quot;caro&quot;;&quot;ok&quot;)</code>, <code className="text-ink">=B2*10%</code>…
        </p>
        <form action={newSheet} className="mb-4 flex gap-2">
          <input name="name" placeholder="Ex: Orçamento da mudança para a Alemanha" className="field" />
          <button className="btn shrink-0">Criar</button>
        </form>
        {custom.length === 0 ? (
          <Empty>Nenhuma planilha livre ainda.</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {custom.map((s) => (
              <li key={s.id}>
                <Link href={`/planilhas/${s.id}`} className="block rounded-xl border border-line bg-panel-2/50 p-3 hover:border-brand">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted">
                    {Object.keys(s.cells).length} células · editada {s.updatedAt.toLocaleDateString("pt-BR")}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
