"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, users, transactions, debts, holdings, goals, customSheets } from "@/db";
import type { SheetCells } from "@/db/schema";
import { checkRateLimit, clientIp, createSession, destroySession, recordAttempt, requireUser, revokeAllSessions } from "@/lib/auth";
import { parseNumber, parseToCents } from "@/lib/money";

export type FormState = { error?: string; ok?: boolean } | undefined;

// Toda entrada do usuário passa por aqui: corta espaços e limita o tamanho
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const dateNoon = (s: string) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};
// Limite de valores: R$ 10 milhões por lançamento (evita estouro do inteiro no banco)
const MAX_CENTS = 1_000_000_000;
const money = (f: FormData, k: string) => Math.min(Math.max(parseToCents(str(f, k, 30)), 0), MAX_CENTS);
const signedMoney = (f: FormData, k: string) => Math.max(Math.min(parseToCents(str(f, k, 30)), MAX_CENTS), -MAX_CENTS);

// hash falso para comparar quando o e-mail não existe (resposta leva o mesmo tempo)
const DUMMY_HASH = bcrypt.hashSync("senha-ficticia-para-tempo-constante", 12);

// ---------- Autenticação ----------

export async function register(_: FormState, f: FormData): Promise<FormState> {
  if (process.env.ALLOW_SIGNUP === "false") return { error: "Cadastros estão fechados no momento." };
  const parsed = z
    .object({
      name: z.string().min(2, "Nome muito curto").max(80, "Nome muito longo"),
      email: z.string().email("E-mail inválido").max(254),
      password: z
        .string()
        .min(10, "A senha precisa de pelo menos 10 caracteres")
        .max(72, "Senha longa demais (máx. 72)")
        .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Use letras e números na senha"),
    })
    .safeParse({ name: str(f, "name"), email: str(f, "email", 254).toLowerCase(), password: String(f.get("password") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ip = await clientIp();
  const blocked = await checkRateLimit(parsed.data.email, ip);
  if (blocked) return { error: blocked };

  const exists = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
  if (exists) {
    await recordAttempt(parsed.data.email, ip, false);
    return { error: "Não foi possível criar a conta com esse e-mail. Se já tem conta, faça login." };
  }

  const [u] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
    })
    .returning();
  await recordAttempt(parsed.data.email, ip, true);
  await createSession({ userId: u.id, name: u.name, v: u.sessionVersion });
  redirect("/");
}

export async function login(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email", 254).toLowerCase();
  const password = String(f.get("password") ?? "").slice(0, 72);
  const ip = await clientIp();
  const blocked = await checkRateLimit(email, ip);
  if (blocked) return { error: blocked };

  const u = await db.query.users.findFirst({ where: eq(users.email, email) });
  const ok = await bcrypt.compare(password, u?.passwordHash ?? DUMMY_HASH);
  await recordAttempt(email, ip, !!(u && ok));
  if (!u || !ok) return { error: "E-mail ou senha incorretos" };

  await createSession({ userId: u.id, name: u.name, v: u.sessionVersion });
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/** Sai de todos os aparelhos (use se perder o celular ou suspeitar de acesso) */
export async function logoutEverywhere() {
  const { userId } = await requireUser();
  await revokeAllSessions(userId);
  await destroySession();
  redirect("/login");
}

// ---------- Transações ----------

export async function saveTransaction(_: FormState, f: FormData): Promise<FormState> {
  const { userId } = await requireUser();
  const amountCents = money(f, "amount");
  if (amountCents <= 0) return { error: "Informe um valor maior que zero" };
  const description = str(f, "description");
  if (!description) return { error: "Informe uma descrição" };
  const values = {
    type: (str(f, "type") === "INCOME" ? "INCOME" : "EXPENSE") as "INCOME" | "EXPENSE",
    amountCents,
    description,
    category: str(f, "category") || "Outros",
    date: dateNoon(str(f, "date")),
    recurring: f.get("recurring") === "on",
  };
  const id = str(f, "id");
  if (id) await db.update(transactions).set(values).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  else await db.insert(transactions).values({ ...values, userId });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTransaction(id: string) {
  const { userId } = await requireUser();
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  revalidatePath("/", "layout");
}

/** Copia os lançamentos recorrentes do mês anterior para o mês informado */
export async function copyRecurring(ym: string) {
  const { userId } = await requireUser();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) return;
  const [y, m] = ym.split("-").map(Number);
  const prevStart = new Date(Date.UTC(y, m - 2, 1));
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const all = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const prev = all.filter((t) => t.recurring && t.date >= prevStart && t.date < start);
  const cur = all.filter((t) => t.date >= start && t.date < end);
  const toAdd = prev.filter((p) => !cur.some((c) => c.description === p.description && c.recurring));
  if (toAdd.length)
    await db.insert(transactions).values(
      toAdd.map((p) => {
        const day = Math.min(p.date.getUTCDate(), new Date(Date.UTC(y, m, 0)).getUTCDate());
        return {
          userId,
          type: p.type,
          amountCents: p.amountCents,
          description: p.description,
          category: p.category,
          recurring: true,
          date: new Date(Date.UTC(y, m - 1, day, 12)),
        };
      }),
    );
  revalidatePath("/", "layout");
}

// ---------- Dívidas ----------

export async function saveDebt(_: FormState, f: FormData): Promise<FormState> {
  const { userId } = await requireUser();
  const name = str(f, "name");
  if (!name) return { error: "Dê um nome para a dívida" };
  const balanceCents = money(f, "balance");
  if (balanceCents <= 0) return { error: "Informe o saldo devedor" };
  const dueDay = Math.max(1, Math.min(31, Math.round(parseNumber(str(f, "dueDay")) || 10)));
  const values = {
    name,
    creditor: str(f, "creditor") || null,
    balanceCents,
    monthlyInterestRate: Math.min(Math.max(parseNumber(str(f, "rate", 20)), 0), 100),
    minPaymentCents: money(f, "minPayment"),
    dueDay,
    notes: str(f, "notes", 500) || null,
  };
  const id = str(f, "id");
  if (id) await db.update(debts).set(values).where(and(eq(debts.id, id), eq(debts.userId, userId)));
  else await db.insert(debts).values({ ...values, userId });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Registra um pagamento: abate do saldo e (opcional) lança como despesa */
export async function payDebt(_: FormState, f: FormData): Promise<FormState> {
  const { userId } = await requireUser();
  const id = str(f, "id");
  const amount = money(f, "amount");
  if (amount <= 0) return { error: "Valor inválido" };
  const d = await db.query.debts.findFirst({ where: and(eq(debts.id, id), eq(debts.userId, userId)) });
  if (!d) return { error: "Dívida não encontrada" };
  const balance = Math.max(0, d.balanceCents - amount);
  await db
    .update(debts)
    .set({ balanceCents: balance, paidOff: balance === 0, lastPaidAt: new Date() })
    .where(eq(debts.id, id));
  if (f.get("asExpense") === "on")
    await db.insert(transactions).values({
      userId,
      type: "EXPENSE",
      amountCents: amount,
      description: `Pagamento: ${d.name}`,
      category: "Dívidas",
      date: dateNoon(""),
    });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteDebt(id: string) {
  const { userId } = await requireUser();
  await db.delete(debts).where(and(eq(debts.id, id), eq(debts.userId, userId)));
  revalidatePath("/", "layout");
}

// ---------- Investimentos ----------

export async function saveHolding(_: FormState, f: FormData): Promise<FormState> {
  const { userId } = await requireUser();
  const kind = str(f, "kind") as "STOCK" | "FII" | "ETF" | "CRYPTO" | "FIXED_INCOME" | "STOCK_US";
  if (!["STOCK", "FII", "ETF", "CRYPTO", "FIXED_INCOME", "STOCK_US"].includes(kind)) return { error: "Classe inválida" };
  let ticker = str(f, "ticker");
  if (!ticker) return { error: "Informe o ativo" };
  ticker = kind === "CRYPTO" ? ticker.toLowerCase() : kind === "FIXED_INCOME" || kind === "STOCK_US" ? ticker : ticker.toUpperCase();
  const quantity = parseNumber(str(f, "quantity", 30)) || (kind === "FIXED_INCOME" ? 1 : 0);
  if (quantity <= 0 || quantity > 1e12) return { error: "Quantidade inválida" };
  const manual = str(f, "manualValue");
  const values = {
    kind,
    ticker,
    name: str(f, "name") || null,
    quantity,
    avgPriceCents: money(f, "avgPrice"),
    manualValueCents: manual ? money(f, "manualValue") : null,
  };
  const id = str(f, "id");
  if (id) await db.update(holdings).set(values).where(and(eq(holdings.id, id), eq(holdings.userId, userId)));
  else await db.insert(holdings).values({ ...values, userId });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteHolding(id: string) {
  const { userId } = await requireUser();
  await db.delete(holdings).where(and(eq(holdings.id, id), eq(holdings.userId, userId)));
  revalidatePath("/", "layout");
}

// ---------- Metas ----------

export async function saveGoal(_: FormState, f: FormData): Promise<FormState> {
  const { userId } = await requireUser();
  const name = str(f, "name");
  const targetCents = money(f, "target");
  if (!name || targetCents <= 0) return { error: "Informe nome e valor-alvo" };
  const deadline = str(f, "deadline");
  const values = {
    name,
    targetCents,
    currentCents: money(f, "current"),
    deadline: deadline ? dateNoon(deadline) : null,
  };
  const id = str(f, "id");
  if (id) await db.update(goals).set(values).where(and(eq(goals.id, id), eq(goals.userId, userId)));
  else await db.insert(goals).values({ ...values, userId });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function depositGoal(_: FormState, f: FormData): Promise<FormState> {
  const { userId } = await requireUser();
  const g = await db.query.goals.findFirst({ where: and(eq(goals.id, str(f, "id")), eq(goals.userId, userId)) });
  if (!g) return { error: "Meta não encontrada" };
  const amount = money(f, "amount");
  await db.update(goals).set({ currentCents: Math.max(0, g.currentCents + amount) }).where(eq(goals.id, g.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteGoal(id: string) {
  const { userId } = await requireUser();
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
  revalidatePath("/", "layout");
}

// ---------- Planilhas livres ----------

export async function createSheet(name: string) {
  const { userId } = await requireUser();
  name = String(name).slice(0, 80);
  const [s] = await db
    .insert(customSheets)
    .values({
      userId,
      name: name.trim() || "Nova planilha",
      cells: {
        A1: "Item",
        B1: "Valor",
        A2: "Exemplo",
        B2: "100",
        A5: "Total",
        B5: "=SOMA(B2:B4)",
      },
    })
    .returning();
  revalidatePath("/planilhas");
  redirect(`/planilhas/${s.id}`);
}

export async function saveSheet(id: string, cells: SheetCells, name?: string) {
  const { userId } = await requireUser();
  const clean: SheetCells = {};
  if (Object.keys(cells).length > 2000) throw new Error("Planilha grande demais");
  for (const [k, v] of Object.entries(cells)) if (/^[A-Z]\d{1,3}$/.test(k) && v !== "") clean[k] = String(v).slice(0, 500);
  await db
    .update(customSheets)
    .set({ cells: clean, updatedAt: new Date(), ...(name ? { name: name.slice(0, 80) } : {}) })
    .where(and(eq(customSheets.id, id), eq(customSheets.userId, userId)));
  revalidatePath("/planilhas");
}

export async function deleteSheet(id: string) {
  const { userId } = await requireUser();
  await db.delete(customSheets).where(and(eq(customSheets.id, id), eq(customSheets.userId, userId)));
  revalidatePath("/planilhas");
  redirect("/planilhas");
}
