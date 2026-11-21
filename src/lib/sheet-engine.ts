// Mini motor de planilha: referências (A1), intervalos (A1:B5), + - * / ^, parênteses,
// e funções SOMA/SUM, MEDIA/AVERAGE, MIN, MAX, CONT/COUNT, ARRED/ROUND, SE/IF.
// Sem eval() — parser próprio, seguro para rodar no navegador.

export type Cells = Record<string, string>;
export type CellValue = number | string | null;

export const COLS = 12; // A..L
export const ROWS = 40;

export function colName(i: number): string {
  return String.fromCharCode(65 + i);
}

export function parseRef(ref: string): { c: number; r: number } | null {
  const m = /^([A-Z])(\d+)$/.exec(ref.toUpperCase());
  if (!m) return null;
  return { c: m[1].charCodeAt(0) - 65, r: Number(m[2]) - 1 };
}

function expandRange(a: string, b: string): string[] {
  const p = parseRef(a);
  const q = parseRef(b);
  if (!p || !q) return [];
  const out: string[] = [];
  for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++)
    for (let r = Math.min(p.r, q.r); r <= Math.max(p.r, q.r); r++) out.push(`${colName(c)}${r + 1}`);
  return out;
}

type Tok = { t: "num" | "ref" | "range" | "fn" | "op" | "lp" | "rp" | "comma" | "str"; v: string };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  // Padrão Excel pt-BR: se a fórmula usa ";" como separador, a vírgula é decimal.
  const commaDecimal = src.includes(";");
  const numRe = commaDecimal ? /^\d+(?:[.,]\d+)?/ : /^\d+(?:\.\d+)?/;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"') {
      const j = src.indexOf('"', i + 1);
      toks.push({ t: "str", v: src.slice(i + 1, j < 0 ? undefined : j) });
      i = j < 0 ? src.length : j + 1;
      continue;
    }
    const num = numRe.exec(src.slice(i));
    if (num) { toks.push({ t: "num", v: num[0].replace(",", ".") }); i += num[0].length; continue; }
    const range = /^[A-Za-z]\d+:[A-Za-z]\d+/.exec(src.slice(i));
    if (range) { toks.push({ t: "range", v: range[0].toUpperCase() }); i += range[0].length; continue; }
    const ref = /^[A-Za-z]\d+/.exec(src.slice(i));
    if (ref) { toks.push({ t: "ref", v: ref[0].toUpperCase() }); i += ref[0].length; continue; }
    const fn = /^[A-Za-zÁÉÍÓÚÇáéíóúç]+(?=\s*\()/.exec(src.slice(i));
    if (fn) { toks.push({ t: "fn", v: fn[0].toUpperCase() }); i += fn[0].length; continue; }
    if ("+-*/^<>=%".includes(ch)) {
      const two = src.slice(i, i + 2);
      if (["<=", ">=", "<>"].includes(two)) { toks.push({ t: "op", v: two }); i += 2; continue; }
      toks.push({ t: "op", v: ch }); i++; continue;
    }
    if (ch === "(") { toks.push({ t: "lp", v: ch }); i++; continue; }
    if (ch === ")") { toks.push({ t: "rp", v: ch }); i++; continue; }
    if (ch === ";" || ch === ",") { toks.push({ t: "comma", v: ch }); i++; continue; }
    throw new Error(`Caractere inválido: ${ch}`);
  }
  return toks;
}

type Val = number | string | number[];

export function evaluateAll(cells: Cells): Record<string, CellValue> {
  const cache: Record<string, CellValue> = {};
  const visiting = new Set<string>();

  function cellValue(ref: string): CellValue {
    if (ref in cache) return cache[ref];
    if (visiting.has(ref)) throw new Error("#CICLO");
    visiting.add(ref);
    const raw = (cells[ref] ?? "").trim();
    let v: CellValue;
    if (raw === "") v = null;
    else if (raw.startsWith("=")) {
      try {
        const r = evalFormula(raw.slice(1));
        v = Array.isArray(r) ? r.reduce((a, b) => a + b, 0) : r;
      } catch (e) {
        v = e instanceof Error && e.message.startsWith("#") ? e.message : "#ERRO";
      }
    } else {
      const n = toNum(raw);
      v = n !== null ? n : raw;
    }
    visiting.delete(ref);
    cache[ref] = v;
    return v;
  }

  function toNum(s: string): number | null {
    let t = s.replace(/[R$\s%]/g, "");
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) || /^-?\d+,\d+$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
    const n = Number(t);
    return s.trim().endsWith("%") ? n / 100 : n;
  }

  function evalFormula(src: string): Val {
    const toks = tokenize(src);
    let pos = 0;
    const peek = () => toks[pos];
    const next = () => toks[pos++];

    function num(v: Val): number {
      if (Array.isArray(v)) return v.reduce((a, b) => a + b, 0);
      if (typeof v === "number") return v;
      if (typeof v === "string" && v.startsWith("#")) throw new Error(v);
      const n = toNum(v);
      return n ?? 0;
    }

    function comparison(): Val {
      let l = additive();
      while (peek()?.t === "op" && ["<", ">", "=", "<=", ">=", "<>"].includes(peek().v)) {
        const op = next().v;
        const a = num(l), b = num(additive());
        l = { "<": a < b, ">": a > b, "=": a === b, "<=": a <= b, ">=": a >= b, "<>": a !== b }[op] ? 1 : 0;
      }
      return l;
    }
    function additive(): Val {
      let l = term();
      while (peek()?.t === "op" && (peek().v === "+" || peek().v === "-")) {
        const op = next().v;
        const r = term();
        l = op === "+" ? num(l) + num(r) : num(l) - num(r);
      }
      return l;
    }
    function term(): Val {
      let l = power();
      while (peek()?.t === "op" && (peek().v === "*" || peek().v === "/")) {
        const op = next().v;
        const r = num(power());
        if (op === "/" && r === 0) throw new Error("#DIV/0");
        l = op === "*" ? num(l) * r : num(l) / r;
      }
      return l;
    }
    function power(): Val {
      const l = unary();
      if (peek()?.t === "op" && peek().v === "^") { next(); return Math.pow(num(l), num(power())); }
      return l;
    }
    function unary(): Val {
      if (peek()?.t === "op" && peek().v === "-") { next(); return -num(unary()); }
      if (peek()?.t === "op" && peek().v === "+") { next(); return num(unary()); }
      let v = primary();
      while (peek()?.t === "op" && peek().v === "%") { next(); v = num(v) / 100; }
      return v;
    }
    function primary(): Val {
      const t = next();
      if (!t) throw new Error("#ERRO");
      if (t.t === "num") return Number(t.v);
      if (t.t === "str") return t.v;
      if (t.t === "ref") { const v = cellValue(t.v); return v === null ? 0 : v; }
      if (t.t === "range")
        return expandRange(...(t.v.split(":") as [string, string]))
          .map(cellValue)
          .filter((v): v is number => typeof v === "number");
      if (t.t === "lp") { const v = comparison(); if (next()?.t !== "rp") throw new Error("#ERRO"); return v; }
      if (t.t === "fn") {
        if (next()?.t !== "lp") throw new Error("#ERRO");
        const args: Val[] = [];
        if (peek()?.t !== "rp") {
          args.push(comparison());
          while (peek()?.t === "comma") { next(); args.push(comparison()); }
        }
        if (next()?.t !== "rp") throw new Error("#ERRO");
        return callFn(t.v, args);
      }
      throw new Error("#ERRO");
    }
    function flat(args: Val[]): number[] {
      return args.flatMap((a) => (Array.isArray(a) ? a : typeof a === "number" ? [a] : []));
    }
    function callFn(name: string, args: Val[]): Val {
      const xs = flat(args);
      switch (name) {
        case "SOMA": case "SUM": return xs.reduce((a, b) => a + b, 0);
        case "MEDIA": case "MÉDIA": case "AVERAGE": return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
        case "MIN": return xs.length ? Math.min(...xs) : 0;
        case "MAX": return xs.length ? Math.max(...xs) : 0;
        case "CONT": case "COUNT": case "CONT.NÚM": return xs.length;
        case "ARRED": case "ROUND": return Number(num(args[0]).toFixed(Math.max(0, num(args[1] ?? 0))));
        case "ABS": return Math.abs(num(args[0]));
        case "SE": case "IF": return num(args[0]) ? (args[1] ?? 1) : (args[2] ?? 0);
        default: throw new Error("#NOME?");
      }
    }

    const result = comparison();
    if (pos < toks.length) throw new Error("#ERRO");
    return result;
  }

  for (const ref of Object.keys(cells)) {
    try { cellValue(ref); } catch (e) { cache[ref] = e instanceof Error ? e.message : "#ERRO"; }
  }
  return cache;
}

export function displayValue(v: CellValue): string {
  if (v === null) return "";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("pt-BR") : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return v;
}

/** Converte fórmula pt-BR para Excel (inglês) na exportação */
export function toExcelFormula(f: string): string {
  return f
    .replace(/^=/, "")
    .replace(/\bSOMA\(/gi, "SUM(")
    .replace(/\bM[ÉE]DIA\(/gi, "AVERAGE(")
    .replace(/\bCONT\(/gi, "COUNT(")
    .replace(/\bARRED\(/gi, "ROUND(")
    .replace(/\bSE\(/gi, "IF(")
    .replace(/;/g, ",");
}
