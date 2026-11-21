import type { AutoSheet, ColType } from "@/lib/auto-sheets";

function fmt(v: string | number | null, type: ColType) {
  if (v === null || v === "") return "";
  if (typeof v === "string") return v;
  switch (type) {
    case "money":
      return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    case "pct":
      return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    case "number":
      return v.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
    default:
      return String(v);
  }
}

const COL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Tabela estilo planilha (somente leitura), com cabeçalho de colunas A, B, C… */
export function DataTable({ sheet }: { sheet: AutoSheet }) {
  const right = (t: ColType) => t !== "text";
  return (
    <div className="overflow-auto rounded-xl border border-line" style={{ maxHeight: "70vh" }}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-panel-2 text-[10px] text-muted">
            <th className="w-10 border-b border-r border-line" />
            {sheet.columns.map((_, i) => (
              <th key={i} className="border-b border-r border-line py-0.5 font-normal">{COL[i]}</th>
            ))}
          </tr>
          <tr className="bg-panel-2">
            <th className="border-b border-r border-line px-2 text-[10px] font-normal text-muted">1</th>
            {sheet.columns.map((c, i) => (
              <th key={i} className={`whitespace-nowrap border-b border-r border-line px-3 py-2 text-xs font-semibold ${right(c.type) ? "text-right" : "text-left"}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.length === 0 && (
            <tr>
              <td colSpan={sheet.columns.length + 1} className="p-6 text-center text-muted">Sem dados ainda — a planilha se monta sozinha conforme você usa o app.</td>
            </tr>
          )}
          {sheet.rows.map((r, ri) => (
            <tr key={ri} className="hover:bg-panel-2/60">
              <td className="border-b border-r border-line bg-panel-2/40 px-2 text-center text-[10px] text-muted">{ri + 2}</td>
              {r.map((v, ci) => {
                const t = sheet.columns[ci]?.type ?? "text";
                const neg = typeof v === "number" && v < 0 && (t === "money" || t === "pct");
                return (
                  <td key={ci} className={`whitespace-nowrap border-b border-r border-line px-3 py-1.5 ${right(t) ? "num text-right" : ""} ${neg ? "text-down" : ""}`}>
                    {fmt(v, t)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {sheet.totals && sheet.rows.length > 0 && (
          <tfoot className="sticky bottom-0">
            <tr className="bg-panel-2 font-semibold">
              <td className="border-r border-t border-line" />
              {sheet.totals.map((v, ci) => {
                const t = sheet.columns[ci]?.type ?? "text";
                return (
                  <td key={ci} className={`whitespace-nowrap border-r border-t border-line px-3 py-2 ${right(t) ? "num text-right" : ""}`}>
                    {fmt(v, t)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
