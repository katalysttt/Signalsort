"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SENTIMENT_COLORS } from "./ui";

const AXIS = { fontSize: 11, fill: "#6b7394" };
const GRID = "#eef0f5";

function TipBox({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-card">
      {label !== undefined && <div className="mb-1 font-medium text-navy">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey + p.name} className="flex items-center gap-2 text-navy-500">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: <span className="font-medium text-navy">{p.value}{unit ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

/** 100% stacked sentiment bar with legend + counts (identity never color-alone). */
export function SentimentBar({ data }: { data: Record<string, number> }) {
  const order = ["positive", "mixed", "neutral", "negative"];
  const total = order.reduce((n, k) => n + (data[k] ?? 0), 0);
  if (!total) return <div className="py-8 text-center text-sm text-navy-400">No analysed feedback yet</div>;
  return (
    <div>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-md" role="img" aria-label="Sentiment distribution">
        {order.map((k) =>
          data[k] ? (
            <div
              key={k}
              title={`${k}: ${data[k]} (${Math.round((data[k] / total) * 100)}%)`}
              style={{ width: `${(data[k] / total) * 100}%`, background: SENTIMENT_COLORS[k] }}
            />
          ) : null,
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {order.map((k) => (
          <div key={k} className="flex items-start gap-2">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SENTIMENT_COLORS[k] }} />
            <div>
              <div className="text-xs capitalize text-navy-400">{k}</div>
              <div className="text-sm font-semibold text-navy">
                {Math.round(((data[k] ?? 0) / total) * 100)}% <span className="font-normal text-navy-400">· {data[k] ?? 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBar({
  data,
  dataKey,
  nameKey,
  color = "#6d55ee",
  height,
  unit,
  colors,
}: {
  data: any[];
  dataKey: string;
  nameKey: string;
  color?: string;
  height?: number;
  unit?: string;
  colors?: string[];
}) {
  const h = height ?? Math.max(120, data.length * 34 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 36, top: 4, bottom: 4 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, (max: number) => Math.max(1, Math.ceil(max * 1.1))]} />
        <YAxis type="category" dataKey={nameKey} tick={AXIS} width={170} axisLine={false} tickLine={false} />
        <Tooltip content={<TipBox unit={unit} />} cursor={{ fill: "rgba(109,85,238,0.06)" }} />
        <Bar dataKey={dataKey} name={dataKey === "count" ? "Items" : dataKey} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
          {colors && data.map((_, i) => <Cell key={i} fill={colors[i] ?? color} />)}
          <LabelList dataKey={dataKey} position="right" style={{ fontSize: 11, fill: "#26325a" }} formatter={(v: any) => `${v}${unit ?? ""}`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({ data, lines }: { data: any[]; lines: { key: string; name: string; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: -16, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(d) => String(d).slice(5)} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<TipBox />} />
        {lines.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FunnelChart({ steps }: { steps: { label: string; users: number; conversionPct: number; dropOff: number; dropOffPct: number }[] }) {
  const max = steps[0]?.users || 1;
  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={s.label}>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="font-medium text-navy">
              {i + 1}. {s.label}
            </span>
            <span className="text-navy-400">
              <span className="font-semibold text-navy">{s.users}</span> users · {s.conversionPct}%
            </span>
          </div>
          <div className="h-7 w-full rounded-md bg-surface">
            <div
              className="flex h-7 items-center rounded-md"
              style={{ width: `${Math.max(2, (s.users / max) * 100)}%`, background: i === steps.length - 1 ? "#2a78d6" : "#6d55ee", opacity: 1 - i * 0.12 }}
              title={`${s.users} users`}
            />
          </div>
          {i > 0 && s.dropOff > 0 && (
            <div className={`mt-1 text-xs ${s.dropOffPct >= 30 ? "font-medium text-red-700" : "text-navy-400"}`}>
              ↓ {s.dropOff} users dropped ({s.dropOffPct}%)
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
