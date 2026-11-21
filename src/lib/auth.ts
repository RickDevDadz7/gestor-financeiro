import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { db, users, authAttempts } from "@/db";

const COOKIE = "gf_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 dias

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET ausente ou fraco (mínimo 32 caracteres). Veja o README.");
  }
  return new TextEncoder().encode(s);
}

export type Session = { userId: string; name: string; v: number };

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, // JavaScript da página não consegue ler o cookie
    secure: process.env.NODE_ENV === "production", // só trafega em HTTPS
    sameSite: "lax", // bloqueia envio em requisições de outros sites (CSRF)
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

async function verifyToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return { userId: String(payload.userId), name: String(payload.name), v: Number(payload.v ?? 0) };
  } catch {
    return null;
  }
}

/**
 * Valida o cookie E confere no banco se a sessão ainda vale
 * (usuário existe e não clicou em "sair de todos os dispositivos").
 */
export async function getSession(): Promise<Session | null> {
  const s = await verifyToken((await cookies()).get(COOKIE)?.value);
  if (!s) return null;
  const [u] = await db
    .select({ v: users.sessionVersion, name: users.name })
    .from(users)
    .where(eq(users.id, s.userId))
    .limit(1);
  if (!u || u.v !== s.v) return null;
  return { ...s, name: u.name };
}

/** Use em páginas/actions: garante usuário logado */
export async function requireUser(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Invalida todas as sessões do usuário (todos os aparelhos) */
export async function revokeAllSessions(userId: string) {
  const [u] = await db.select({ v: users.sessionVersion }).from(users).where(eq(users.id, userId));
  if (u) await db.update(users).set({ sessionVersion: u.v + 1 }).where(eq(users.id, userId));
}

// ---------- Proteção contra força bruta ----------

const WINDOW_MIN = 15;
const MAX_FAILS_PER_EMAIL = 5; // 5 senhas erradas → bloqueia esse e-mail por 15 min
const MAX_PER_IP = 30; // 30 tentativas por IP em 15 min

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64);
}

/** Retorna mensagem de bloqueio, ou null se pode tentar */
export async function checkRateLimit(email: string, ip: string): Promise<string | null> {
  const since = new Date(Date.now() - WINDOW_MIN * 60_000);
  const [[byEmail], [byIp]] = await Promise.all([
    db
      .select({ n: count() })
      .from(authAttempts)
      .where(and(eq(authAttempts.key, `login:${email}`), eq(authAttempts.success, false), gte(authAttempts.createdAt, since))),
    db
      .select({ n: count() })
      .from(authAttempts)
      .where(and(eq(authAttempts.key, `ip:${ip}`), gte(authAttempts.createdAt, since))),
  ]);
  if (byEmail.n >= MAX_FAILS_PER_EMAIL || byIp.n >= MAX_PER_IP)
    return `Muitas tentativas. Aguarde ${WINDOW_MIN} minutos e tente de novo.`;
  return null;
}

export async function recordAttempt(email: string, ip: string, success: boolean) {
  await db.insert(authAttempts).values([
    { key: `login:${email}`, success },
    { key: `ip:${ip}`, success },
  ]);
  if (success) {
    // login certo zera o contador de erros daquele e-mail
    await db.delete(authAttempts).where(and(eq(authAttempts.key, `login:${email}`), eq(authAttempts.success, false)));
  }
  // limpeza ocasional de registros velhos
  if (Math.random() < 0.05) {
    await db.delete(authAttempts).where(lt(authAttempts.createdAt, new Date(Date.now() - 24 * 3600_000)));
  }
}

export const SESSION_COOKIE = COOKIE;
