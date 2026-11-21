"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compact = (v: number) => v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

const tooltipStyle = {
  contentStyle: { background: "#18202b", border: "1px solid #243041", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#e8eef5" },
  itemStyle: { color: "#e8eef5" },
};

export const PALETTE = ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#06b6d4", "#f43f5e", "#84cc16", "#eab308"];

export function CashflowChart({ data }: { data: { label: string; receitas: number; despesas: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -12, right: 4, top: 4 }}>
          <CartesianGrid stroke="#243041" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#8a97a8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={compact} tick={{ fill: "#8a97a8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => brl(Number(v))} cursor={{ fill: "#ffffff08" }} {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="despesas" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBars({ data }: { data: { category: string; value: number }[] }) {
  const h = Math.max(140, data.length * 30);
  return (
    <div className="w-full" style={{ height: h }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="category" width={110} tick={{ fill: "#8a97a8", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => brl(Number(v))} cursor={{ fill: "#ffffff08" }} {...tooltipStyle} />
          <Bar dataKey="value" name="Gasto" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AllocationPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => brl(Number(v))} {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
