"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteSheet, saveSheet } from "@/app/actions";
import { COLS, ROWS, colName, displayValue, evaluateAll, type Cells } from "@/lib/sheet-engine";

export function SheetEditor({ id, initialName, initialCells }: { id: string; initialName: string; initialCells: Cells }) {
  const [cells, setCells] = useState<Cells>(initialCells);
  const [name, setName] = useState(initialName);
  const [sel, setSel] = useState("A1");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"salvo" | "salvando" | "pendente">("salvo");
  const [, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const first = useRef(true);

  const values = useMemo(() => evaluateAll(cells), [cells]);

  // autosave com debounce
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStatus("pendente");
    const t = setTimeout(() => {
      setStatus("salvando");
      start(async () => { await saveSheet(id, cells, name); setStatus("salvo"); });
    }, 800);
    return () => clearTimeout(t);
  }, [cells, name, id]);

  const commit = (ref: string, v: string) => {
    setCells((c) => {
      const n = { ...c };
      if (v.trim() === "") delete n[ref]; else n[ref] = v;
      return n;
    });
  };

  const move = (ref: string, dc: number, dr: number) => {
    const c = ref.charCodeAt(0) - 65 + dc;
    const r = Number(ref.slice(1)) + dr;
    if (c < 0 || c >= COLS || r < 1 || r > ROWS) return ref;
    return `${colName(c)}${r}`;
  };

  const startEdit = (ref: string, initial?: string) => {
    setSel(ref);
    setEditing(ref);
    setDraft(initial ?? cells[ref] ?? "");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    if (editing) return;
    const k = e.key;
    const map: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], Tab: [1, 0] };
    if (map[k]) { e.preventDefault(); setSel((s) => move(s, ...map[k])); return; }
    if (k === "Enter" || k === "F2") { e.preventDefault(); startEdit(sel); return; }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); commit(sel, ""); return; }
    if (k.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); startEdit(sel, k); }
  };

  const finish = (dir: [number, number] | null) => {
    if (!editing) return;
    commit(editing, draft);
    const next = dir ? move(editing, ...dir) : editing;
    setEditing(null);
    setSel(next);
    setTimeout(() => gridRef.current?.focus(), 0);
  };
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none" />
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>{status === "salvo" ? "✓ salvo" : status === "salvando" ? "salvando…" : "editando…"}</span>
          <button className="btn-danger" onClick={() => confirm("Excluir esta planilha?") && start(() => deleteSheet(id))}>Excluir</button>
        </div>
      </div>

      {/* barra de fórmula */}
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-panel p-1.5">
        <span className="num w-12 shrink-0 rounded bg-panel-2 px-2 py-1 text-center text-xs text-muted">{sel}</span>
        <input
          className="num w-full bg-transparent px-1 text-sm outline-none"
          value={editing === sel ? draft : cells[sel] ?? ""}
          placeholder="Digite um valor ou fórmula (=SOMA(B2:B5))"
          onFocus={() => editing !== sel && startEdit(sel)}
          onChange={(e) => { if (editing !== sel) startEdit(sel); setDraft(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") finish([0, 1]); if (e.key === "Escape") setEditing(null); }}
        />
      </div>

      <div ref={gridRef} tabIndex={0} onKeyDown={onGridKey} className="overflow-auto rounded-xl border border-line outline-none" style={{ maxHeight: "72vh" }}>
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-panel-2 text-xs text-muted">
              <th className="sticky left-0 z-20 w-10 border-b border-r border-line bg-panel-2" />
              {Array.from({ length: COLS }, (_, c) => (
                <th key={c} className="min-w-28 border-b border-r border-line py-1 font-normal">{colName(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, r) => (
              <tr key={r}>
                <td className="sticky left-0 border-b border-r border-line bg-panel-2 px-2 text-center text-xs text-muted">{r + 1}</td>
                {Array.from({ length: COLS }, (_, c) => {
                  const ref = `${colName(c)}${r + 1}`;
                  const v = values[ref] ?? null;
                  const isSel = sel === ref;
                  const isFormula = (cells[ref] ?? "").startsWith("=");
                  const isErr = typeof v === "string" && v.startsWith("#");
                  return (
                    <td
                      key={c}
                      onClick={() => (isSel ? startEdit(ref) : setSel(ref))}
                      onDoubleClick={() => startEdit(ref)}
                      className={`h-8 border-b border-r border-line px-2 ${isSel ? "outline outline-2 -outline-offset-2 outline-brand" : ""} ${typeof v === "number" ? "num text-right" : ""} ${isFormula && !isErr ? "text-brand" : ""} ${isErr ? "text-down" : ""} ${typeof v === "number" && v < 0 ? "text-down" : ""}`}
                    >
                      {editing === ref ? (
                        <input
                          ref={inputRef}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => finish(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); finish([0, 1]); }
                            if (e.key === "Tab") { e.preventDefault(); finish([1, 0]); }
                            if (e.key === "Escape") { setEditing(null); gridRef.current?.focus(); }
                          }}
                          className="num w-full bg-transparent text-left text-ink outline-none"
                        />
                      ) : (
                        <span className="block max-w-56 truncate">{displayValue(v)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        Toque numa célula para selecionar e de novo para editar. Fórmulas: SOMA, MEDIA, MIN, MAX, CONT, ARRED, SE, ABS, %, ^. Salva sozinho.
      </p>
    </div>
  );
}
