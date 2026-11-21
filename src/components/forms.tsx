"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import {
  saveTransaction,
  saveDebt,
  payDebt,
  saveHolding,
  saveGoal,
  depositGoal,
  deleteTransaction,
  deleteDebt,
  deleteHolding,
  deleteGoal,
  copyRecurring,
  type FormState,
} from "@/app/actions";

type Action = (s: FormState, f: FormData) => Promise<FormState>;

function useForm(action: Action, resetOnOk = true) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnOk) {
      ref.current?.reset();
      ref.current?.closest("details")?.removeAttribute("open");
    }
  }, [state, resetOnOk]);
  return { state, formAction, pending, ref };
}

function Msg({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return <p className="text-sm text-down">{state.error}</p>;
}

const cents = (c?: number | null) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");

export const EXPENSE_CATEGORIES = [
  "Moradia", "Alimentação", "Mercado", "Transporte", "Saúde", "Educação", "Lazer",
  "Assinaturas", "Contas (luz, água, internet)", "Compras", "Dívidas", "Investimentos", "Impostos", "Outros",
];
export const INCOME_CATEGORIES = ["Salário", "Freela", "Vendas", "Rendimentos", "Reembolso", "Outros"];

// ---------- Transação ----------

export function TransactionForm({
  tx,
}: {
  tx?: { id: string; type: string; amountCents: number; description: string; category: string; date: Date; recurring: boolean };
}) {
  const { state, formAction, pending, ref } = useForm(saveTransaction, !tx);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form ref={ref} action={formAction} className="grid gap-3 sm:grid-cols-2">
      {tx && <input type="hidden" name="id" value={tx.id} />}
      <div className="grid grid-cols-2 gap-2 sm:col-span-2">
        {(["EXPENSE", "INCOME"] as const).map((t) => (
          <label key={t} className="cursor-pointer">
            <input type="radio" name="type" value={t} defaultChecked={(tx?.type ?? "EXPENSE") === t} className="peer sr-only" />
            <span
              className={`block rounded-lg border border-line py-2 text-center text-sm peer-checked:bg-panel-2 ${
                t === "EXPENSE" ? "peer-checked:border-down peer-checked:text-down" : "peer-checked:border-up peer-checked:text-up"
              }`}
            >
              {t === "EXPENSE" ? "Despesa" : "Receita"}
            </span>
          </label>
        ))}
      </div>
      <div>
        <label className="label">Valor (R$)</label>
        <input name="amount" inputMode="decimal" placeholder="0,00" defaultValue={cents(tx?.amountCents)} className="field num" required />
      </div>
      <div>
        <label className="label">Data</label>
        <input name="date" type="date" defaultValue={tx ? new Date(tx.date).toISOString().slice(0, 10) : today} className="field" />
      </div>
      <div>
        <label className="label">Descrição</label>
        <input name="description" placeholder="Ex: Aluguel" defaultValue={tx?.description} className="field" required />
      </div>
      <div>
        <label className="label">Categoria</label>
        <input name="category" list="cats" placeholder="Escolha ou digite" defaultValue={tx?.category} className="field" />
        <datalist id="cats">
          {[...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
        <input type="checkbox" name="recurring" defaultChecked={tx?.recurring} className="accent-[var(--color-brand)]" />
        Fixo todo mês (aluguel, salário, assinaturas…)
      </label>
      <Msg state={state} />
      <button disabled={pending} className="btn sm:col-span-2">{pending ? "Salvando…" : tx ? "Salvar alterações" : "Adicionar"}</button>
    </form>
  );
}

// ---------- Dívida ----------

export function DebtForm({
  debt,
}: {
  debt?: { id: string; name: string; creditor: string | null; balanceCents: number; monthlyInterestRate: number; minPaymentCents: number; dueDay: number; notes: string | null };
}) {
  const { state, formAction, pending, ref } = useForm(saveDebt, !debt);
  return (
    <form ref={ref} action={formAction} className="grid gap-3 sm:grid-cols-2">
      {debt && <input type="hidden" name="id" value={debt.id} />}
      <div>
        <label className="label">Nome</label>
        <input name="name" placeholder="Ex: Cartão Nubank" defaultValue={debt?.name} className="field" required />
      </div>
      <div>
        <label className="label">Credor (opcional)</label>
        <input name="creditor" placeholder="Banco / pessoa" defaultValue={debt?.creditor ?? ""} className="field" />
      </div>
      <div>
        <label className="label">Saldo devedor (R$)</label>
        <input name="balance" inputMode="decimal" placeholder="0,00" defaultValue={cents(debt?.balanceCents)} className="field num" required />
      </div>
      <div>
        <label className="label">Juros ao mês (%)</label>
        <input name="rate" inputMode="decimal" placeholder="Ex: 12,5 (cartão) / 2,1 (empréstimo)" defaultValue={debt ? String(debt.monthlyInterestRate).replace(".", ",") : ""} className="field num" />
      </div>
      <div>
        <label className="label">Parcela / pagamento mínimo (R$)</label>
        <input name="minPayment" inputMode="decimal" placeholder="0,00" defaultValue={cents(debt?.minPaymentCents)} className="field num" />
      </div>
      <div>
        <label className="label">Dia do vencimento</label>
        <input name="dueDay" type="number" min={1} max={31} placeholder="10" defaultValue={debt?.dueDay} className="field num" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Observações</label>
        <input name="notes" placeholder="Ex: dá pra negociar no Serasa Limpa Nome" defaultValue={debt?.notes ?? ""} className="field" />
      </div>
      <Msg state={state} />
      <button disabled={pending} className="btn sm:col-span-2">{pending ? "Salvando…" : debt ? "Salvar alterações" : "Adicionar dívida"}</button>
    </form>
  );
}

export function PayDebtForm({ id, suggested }: { id: string; suggested: number }) {
  const { state, formAction, pending, ref } = useForm(payDebt);
  return (
    <form ref={ref} action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="min-w-32 flex-1">
        <label className="label">Valor pago (R$)</label>
        <input name="amount" inputMode="decimal" defaultValue={cents(suggested)} className="field num" />
      </div>
      <label className="flex items-center gap-1.5 pb-2.5 text-xs text-muted">
        <input type="checkbox" name="asExpense" defaultChecked className="accent-[var(--color-brand)]" /> lançar como gasto
      </label>
      <button disabled={pending} className="btn">{pending ? "…" : "Registrar"}</button>
      <div className="w-full"><Msg state={state} /></div>
    </form>
  );
}

// ---------- Investimento ----------

export function HoldingForm({
  h,
}: {
  h?: { id: string; kind: string; ticker: string; name: string | null; quantity: number; avgPriceCents: number; manualValueCents: number | null };
}) {
  const { state, formAction, pending, ref } = useForm(saveHolding, !h);
  return (
    <form ref={ref} action={formAction} className="grid gap-3 sm:grid-cols-2">
      {h && <input type="hidden" name="id" value={h.id} />}
      <div>
        <label className="label">Classe</label>
        <select name="kind" defaultValue={h?.kind ?? "STOCK"} className="field">
          <option value="STOCK">Ação B3 (ex: PETR4)</option>
          <option value="FII">FII (ex: HGLG11)</option>
          <option value="ETF">ETF B3 (ex: BOVA11, IVVB11)</option>
          <option value="CRYPTO">Cripto (id CoinGecko: bitcoin)</option>
          <option value="FIXED_INCOME">Renda fixa (CDB, Tesouro…)</option>
          <option value="STOCK_US">Exterior (valor manual)</option>
        </select>
      </div>
      <div>
        <label className="label">Ativo / ticker</label>
        <input name="ticker" placeholder="PETR4 · bitcoin · Tesouro Selic 2029" defaultValue={h?.ticker} className="field" required />
      </div>
      <div>
        <label className="label">Quantidade</label>
        <input name="quantity" inputMode="decimal" placeholder="Ex: 100 ou 0,015" defaultValue={h ? String(h.quantity).replace(".", ",") : ""} className="field num" />
      </div>
      <div>
        <label className="label">Preço médio pago por unidade (R$)</label>
        <input name="avgPrice" inputMode="decimal" placeholder="0,00" defaultValue={cents(h?.avgPriceCents)} className="field num" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Valor atual manual (R$) — só para renda fixa / exterior</label>
        <input name="manualValue" inputMode="decimal" placeholder="Deixe vazio para usar a cotação automática" defaultValue={cents(h?.manualValueCents)} className="field num" />
      </div>
      <Msg state={state} />
      <button disabled={pending} className="btn sm:col-span-2">{pending ? "Salvando…" : h ? "Salvar alterações" : "Adicionar ativo"}</button>
    </form>
  );
}

// ---------- Metas ----------

export function GoalForm({ g }: { g?: { id: string; name: string; targetCents: number; currentCents: number; deadline: Date | null } }) {
  const { state, formAction, pending, ref } = useForm(saveGoal, !g);
  return (
    <form ref={ref} action={formAction} className="grid gap-3 sm:grid-cols-2">
      {g && <input type="hidden" name="id" value={g.id} />}
      <div className="sm:col-span-2">
        <label className="label">Meta</label>
        <input name="name" list="goal-ideas" placeholder="Ex: Reserva de emergência" defaultValue={g?.name} className="field" required />
        <datalist id="goal-ideas">
          <option value="Reserva de emergência" />
          <option value="Mudar para a Alemanha" />
          <option value="Primeiro R$ 100 mil" />
          <option value="Quitar todas as dívidas" />
        </datalist>
      </div>
      <div>
        <label className="label">Valor-alvo (R$)</label>
        <input name="target" inputMode="decimal" defaultValue={cents(g?.targetCents)} className="field num" required />
      </div>
      <div>
        <label className="label">Já guardado (R$)</label>
        <input name="current" inputMode="decimal" defaultValue={cents(g?.currentCents)} className="field num" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Prazo (opcional)</label>
        <input name="deadline" type="date" defaultValue={g?.deadline ? new Date(g.deadline).toISOString().slice(0, 10) : ""} className="field" />
      </div>
      <Msg state={state} />
      <button disabled={pending} className="btn sm:col-span-2">{pending ? "Salvando…" : g ? "Salvar" : "Criar meta"}</button>
    </form>
  );
}

export function DepositForm({ id }: { id: string }) {
  const { state, formAction, pending, ref } = useForm(depositGoal);
  return (
    <form ref={ref} action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex-1">
        <label className="label">Aporte (use − para retirar)</label>
        <input name="amount" inputMode="decimal" placeholder="0,00" className="field num" />
      </div>
      <button disabled={pending} className="btn">{pending ? "…" : "Guardar"}</button>
      <Msg state={state} />
    </form>
  );
}

// ---------- Botões ----------

const DELETERS = { tx: deleteTransaction, debt: deleteDebt, holding: deleteHolding, goal: deleteGoal };

export function DeleteButton({ kind, id }: { kind: keyof typeof DELETERS; id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="btn-danger"
      onClick={() => {
        if (confirm("Excluir este item?")) start(() => DELETERS[kind](id));
      }}
    >
      {pending ? "…" : "Excluir"}
    </button>
  );
}

export function CopyRecurringButton({ ym }: { ym: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="btn-ghost" onClick={() => start(() => copyRecurring(ym))}>
      {pending ? "Copiando…" : "↻ Puxar fixos do mês anterior"}
    </button>
  );
}
