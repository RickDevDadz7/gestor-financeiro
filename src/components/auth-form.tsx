"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions";

export function AuthForm({ mode }: { mode: "login" | "cadastro" }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : register, undefined);
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/icon.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
          <h1 className="text-2xl font-bold">Gestor Financeiro</h1>
          <p className="mt-1 text-sm text-muted">Do zero à riqueza, um mês de cada vez.</p>
        </div>
        <form action={action} className="space-y-3 rounded-2xl border border-line bg-panel p-5">
          {mode === "cadastro" && (
            <div>
              <label className="label">Nome</label>
              <input name="name" className="field" autoComplete="name" required />
            </div>
          )}
          <div>
            <label className="label">E-mail</label>
            <input name="email" type="email" className="field" autoComplete="email" required />
          </div>
          <div>
            <label className="label">Senha</label>
            <input
              name="password"
              type="password"
              className="field"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "cadastro" ? 8 : undefined}
              required
            />
          </div>
          {state?.error && <p className="text-sm text-down">{state.error}</p>}
          <button disabled={pending} className="btn w-full">
            {pending ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          {mode === "login" ? (
            <>Não tem conta? <Link href="/cadastro" className="text-brand">Criar agora</Link></>
          ) : (
            <>Já tem conta? <Link href="/login" className="text-brand">Entrar</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
