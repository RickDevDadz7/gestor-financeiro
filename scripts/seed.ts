// Cria um usuário de demonstração com dados de exemplo.
// Uso: npm run seed   →  login: demo@gestor.app / demo1234
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users, transactions, debts, holdings, goals, customSheets } from "../src/db";

async function main() {
  const email = "demo@gestor.app";
  await db.delete(users).where(eq(users.email, email));
  const [u] = await db
    .insert(users)
    .values({ name: "Rick Demo", email, passwordHash: await bcrypt.hash("demo1234", 10) })
    .returning();

  const now = new Date();
  const tx: (typeof transactions.$inferInsert)[] = [];
  for (let back = 5; back >= 0; back--) {
    const y = now.getFullYear();
    const m = now.getMonth() - back;
    const d = (day: number) => new Date(Date.UTC(y, m, Math.min(day, 28), 12));
    const jitter = (base: number) => Math.round(base * (0.85 + Math.random() * 0.3));
    tx.push(
      { userId: u.id, type: "INCOME", amountCents: 450000, description: "Salário", category: "Salário", date: d(5), recurring: true },
      { userId: u.id, type: "INCOME", amountCents: jitter(80000), description: "Freela site", category: "Freela", date: d(18) },
      { userId: u.id, type: "EXPENSE", amountCents: 140000, description: "Aluguel", category: "Moradia", date: d(10), recurring: true },
      { userId: u.id, type: "EXPENSE", amountCents: jitter(85000), description: "Supermercado", category: "Mercado", date: d(8) },
      { userId: u.id, type: "EXPENSE", amountCents: jitter(30000), description: "iFood", category: "Alimentação", date: d(14) },
      { userId: u.id, type: "EXPENSE", amountCents: jitter(25000), description: "Uber / ônibus", category: "Transporte", date: d(20) },
      { userId: u.id, type: "EXPENSE", amountCents: 12000, description: "Internet", category: "Contas (luz, água, internet)", date: d(12), recurring: true },
      { userId: u.id, type: "EXPENSE", amountCents: jitter(18000), description: "Luz + água", category: "Contas (luz, água, internet)", date: d(15) },
      { userId: u.id, type: "EXPENSE", amountCents: 9990, description: "Curso de alemão", category: "Educação", date: d(3), recurring: true },
      { userId: u.id, type: "EXPENSE", amountCents: 5590, description: "Streaming", category: "Assinaturas", date: d(7), recurring: true },
      { userId: u.id, type: "EXPENSE", amountCents: jitter(20000), description: "Saídas", category: "Lazer", date: d(22) },
    );
  }
  await db.insert(transactions).values(tx);

  await db.insert(debts).values([
    { userId: u.id, name: "Cartão de crédito (rotativo)", creditor: "Banco X", balanceCents: 320000, monthlyInterestRate: 14.5, minPaymentCents: 48000, dueDay: 15 },
    { userId: u.id, name: "Empréstimo pessoal", creditor: "Banco Y", balanceCents: 850000, monthlyInterestRate: 3.9, minPaymentCents: 42000, dueDay: 5 },
    { userId: u.id, name: "Notebook parcelado", creditor: "Loja", balanceCents: 180000, monthlyInterestRate: 0, minPaymentCents: 30000, dueDay: 25 },
  ]);

  await db.insert(holdings).values([
    { userId: u.id, kind: "FIXED_INCOME", ticker: "Tesouro Selic 2029", quantity: 1, avgPriceCents: 250000, manualValueCents: 263000 },
    { userId: u.id, kind: "STOCK", ticker: "ITUB4", quantity: 20, avgPriceCents: 3150 },
    { userId: u.id, kind: "FII", ticker: "HGLG11", quantity: 5, avgPriceCents: 15800 },
    { userId: u.id, kind: "ETF", ticker: "IVVB11", quantity: 3, avgPriceCents: 33000 },
    { userId: u.id, kind: "CRYPTO", ticker: "bitcoin", quantity: 0.003, avgPriceCents: 52000000 },
  ]);

  await db.insert(goals).values([
    { userId: u.id, name: "Reserva de emergência", targetCents: 1200000, currentCents: 150000 },
    { userId: u.id, name: "Mudar para a Alemanha", targetCents: 6000000, currentCents: 200000, deadline: new Date(Date.UTC(now.getFullYear() + 2, 0, 15, 12)) },
  ]);

  await db.insert(customSheets).values({
    userId: u.id,
    name: "Custos da mudança",
    cells: {
      A1: "Item", B1: "Valor (R$)", C1: "Observação",
      A2: "Passagem", B2: "4500",
      A3: "Visto + traduções", B3: "2200",
      A4: "Caução do apartamento", B4: "9000", C4: "3x aluguel",
      A5: "Primeiro mês", B5: "8000",
      A6: "Reserva extra", B6: "=SOMA(B2:B5)*20%",
      A8: "TOTAL", B8: "=SOMA(B2:B6)",
      A9: "Meses p/ juntar (R$ 1.500/mês)", B9: "=ARRED(B8/1500;0)",
    },
  });

  console.log("✓ Demo criada: demo@gestor.app / demo1234");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
