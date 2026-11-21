import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, customSheets } from "@/db";
import { requireUser } from "@/lib/auth";
import { SheetEditor } from "@/components/sheet-editor";

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUser();
  const { id } = await params;
  const sheet = await db.query.customSheets.findFirst({ where: and(eq(customSheets.id, id), eq(customSheets.userId, userId)) });
  if (!sheet) notFound();
  return (
    <>
      <Link href="/planilhas" className="mb-3 inline-block text-sm text-muted hover:text-ink">‹ Planilhas</Link>
      <SheetEditor id={sheet.id} initialName={sheet.name} initialCells={sheet.cells} />
    </>
  );
}
