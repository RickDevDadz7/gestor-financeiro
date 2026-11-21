"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Início", icon: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/transacoes", label: "Gastos", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/dividas", label: "Dívidas", icon: "M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
  { href: "/investimentos", label: "Investir", icon: "M3 17l6-6 4 4 8-8M14 7h7v7" },
  { href: "/mercado", label: "Mercado", icon: "M4 19V9m6 10V5m6 14v-7m4 7H2" },
  { href: "/metas", label: "Metas", icon: "M12 22a10 10 0 110-20 10 10 0 010 20zm0-6a4 4 0 110-8 4 4 0 010 8z" },
  { href: "/planilhas", label: "Planilhas", icon: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function SideNav({ name }: { name: string }) {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-panel/60 p-4 md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <img src="/icon.svg" alt="" className="h-8 w-8" />
        <div>
          <div className="text-sm font-bold">Gestor Financeiro</div>
          <div className="text-[11px] text-muted">do zero à riqueza</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              active(i.href) ? "bg-brand/15 text-brand" : "text-muted hover:bg-panel-2 hover:text-ink"
            }`}
          >
            <Icon d={i.icon} />
            {i.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-line pt-3 text-xs text-muted">
        <div className="truncate px-2">Olá, {name}</div>
        <form action="/sair" method="post">
          <button className="mt-1 w-full rounded-lg px-2 py-1.5 text-left hover:bg-panel-2 hover:text-ink">Sair</button>
        </form>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid grid-cols-7">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${active(i.href) ? "text-brand" : "text-muted"}`}
          >
            <Icon d={i.icon} />
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
