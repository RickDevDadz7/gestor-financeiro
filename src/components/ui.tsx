import { fmtBRL, fmtPct } from "@/lib/money";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-muted">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, cents, hint, tone }: { label: string; cents: number; hint?: string; tone?: "up" | "down" | "auto" }) {
  const color = tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "auto" ? (cents >= 0 ? "text-up" : "text-down") : "text-ink";
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num mt-1 text-lg font-semibold sm:text-xl ${color}`}>{fmtBRL(cents)}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "warn" | "down" }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  const bg = tone === "warn" ? "bg-warn" : tone === "down" ? "bg-down" : "bg-brand";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-panel-2">
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Change({ pct, className = "" }: { pct: number | null; className?: string }) {
  if (pct === null || !Number.isFinite(pct)) return <span className={`text-muted ${className}`}>—</span>;
  return <span className={`num ${pct >= 0 ? "text-up" : "text-down"} ${className}`}>{fmtPct(pct)}</span>;
}

export function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "up" | "down" | "warn" }) {
  const cls = {
    muted: "bg-panel-2 text-muted",
    up: "bg-up/15 text-up",
    down: "bg-down/15 text-down",
    warn: "bg-warn/15 text-warn",
  }[tone];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}

/** Bloco "Adicionar" recolhível — funciona bem no celular */
export function AddPanel({ label, children, open = false }: { label: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-line bg-panel">
      <summary className="flex items-center justify-between px-4 py-3 text-sm font-semibold">
        <span>{label}</span>
        <span className="text-brand transition group-open:rotate-45 text-xl leading-none">+</span>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

export const Disclaimer = () => (
  <p className="mt-6 text-center text-[11px] text-muted">
    Conteúdo educativo, baseado em regras gerais de finanças pessoais. Não é recomendação de investimento.
  </p>
);
