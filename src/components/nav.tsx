"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutEverywhere } from "@/app/actions";

const ITEMS = [
  { href: "/", label: "Início", icon: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/transacoes", label: "Gastos", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/dividas", label: "Dívidas", icon: "M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
  { href: "/investimentos", label: "Investir", icon: "M3 17l6-6 4 4 8-8M14 7h7v7" },
  { href: "/mercado", label: "Mercado", icon: "M4 19V9m6 10V5m6 14v-7m4 7H2" },
  { href: "/metas", label: "Metas", icon: "M12 22a10 10 0 110-20 10 10 0 010 20zm0-6a4 4 0 110-8 4 4 0 010 8z" },
  { href: "/planilhas", label: "Planilhas", icon: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18" },
];

function Icon({ d, size = "h-5 w-5", stroke = 1.8 }: { d: string; size?: string; stroke?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
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
        <form action={logoutEverywhere}>
          <button className="w-full rounded-lg px-2 py-1.5 text-left text-[11px] hover:bg-panel-2 hover:text-ink">Sair de todos os aparelhos</button>
        </form>
      </div>
    </aside>
  );
}

// No celular: 4 abas principais + "Mais" (painel que sobe com o resto)
const PRIMARY = ["/", "/transacoes", "/dividas", "/investimentos"];
const MORE_ICON = "M5 12h.01M12 12h.01M19 12h.01";

export function BottomNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const primary = ITEMS.filter((i) => PRIMARY.includes(i.href));
  const more = ITEMS.filter((i) => !PRIMARY.includes(i.href));
  const moreActive = more.some((i) => active(i.href));

  // fecha o painel ao trocar de página e com a tecla Esc
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
          <button aria-label="Fechar" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <div className="grid grid-cols-3 gap-2">
              {more.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl py-4 text-xs ${
                    active(i.href) ? "bg-brand/15 text-brand" : "bg-panel-2 text-ink"
                  }`}
                >
                  <Icon d={i.icon} size="h-6 w-6" />
                  {i.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
              <form action="/sair" method="post">
                <button className="rounded-lg px-3 py-2 text-muted hover:text-ink">Sair</button>
              </form>
              <form action={logoutEverywhere}>
                <button className="rounded-lg px-3 py-2 text-xs text-muted hover:text-ink">Sair de todos os aparelhos</button>
              </form>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {primary.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${active(i.href) ? "text-brand" : "text-muted"}`}
            >
              <Icon d={i.icon} size="h-6 w-6" />
              {i.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${open || moreActive ? "text-brand" : "text-muted"}`}
          >
            <Icon d={MORE_ICON} size="h-6 w-6" stroke={3.2} />
            Mais
          </button>
        </div>
      </nav>
    </>
  );
}
