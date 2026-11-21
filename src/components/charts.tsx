"use client";
import {
  Area,
  AreaChart,
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
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, niceMax]} />
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

/** Tiny trend line for KPI cards (no axes; values in tooltip-free form). */
export function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  if (data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, bottom: 4, left: 2, right: 2 }}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Area chart with gradient fill; one or more series on ONE shared scale. */
export function AreaTrend({ data, series, height = 240 }: { data: any[]; series: { key: string; name: string; color: string; fill?: boolean }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: -12, right: 12, top: 8, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(d) => fmtDay(String(d))} minTickGap={24} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<TipBox />} cursor={{ stroke: "#c9c2f7", strokeDasharray: "4 4" }} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            fill={s.fill === false ? "transparent" : `url(#fill-${s.key})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function fmtDay(d: string) {
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Cohort-style heatmap: one sequential hue, light → dark by count. */
export function Heatmap({ rows, cols, value, colLabels }: { rows: string[]; cols: string[]; value: (r: string, c: string) => number; colLabels?: Record<string, string> }) {
  const max = Math.max(1, ...rows.flatMap((r) => cols.map((c) => value(r, c))));
  const shade = (v: number) => {
    if (!v) return { background: "#f4f5f9", color: "#9aa1bb" };
    const t = v / max;
    // violet ramp: light #e4dffd → dark #4a35c2
    const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
    const bg = `rgb(${mix(228, 74)}, ${mix(223, 53)}, ${mix(253, 194)})`;
    return { background: bg, color: t > 0.45 ? "#fff" : "#26325a" };
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-1 text-xs">
        <colgroup>
          <col className="w-[40%]" />
        </colgroup>
        <thead>
          <tr>
            <th className="pb-1 text-left font-medium text-navy-400">Category</th>
            {cols.map((c) => (
              <th key={c} className="pb-1 font-medium text-navy-400">
                {colLabels?.[c] ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <td className="max-w-[118px] truncate pr-2 text-navy-500" title={r}>{r}</td>
              {cols.map((c) => {
                const v = value(r, c);
                return (
                  <td key={c} className="h-8 w-10 min-w-[34px] rounded-md text-center font-medium" style={shade(v)} title={`${r} · ${colLabels?.[c] ?? c}: ${v}`}>
                    {v || "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-navy-400">
        Fewer
        {[0.15, 0.4, 0.65, 0.9].map((t) => (
          <span key={t} className="h-2.5 w-4 rounded-sm" style={{ background: `rgb(${Math.round(228 - 154 * t)}, ${Math.round(223 - 170 * t)}, ${Math.round(253 - 59 * t)})` }} />
        ))}
        More
      </div>
    </div>
  );
}

function niceMax(max: number) {
  if (max <= 5) return Math.max(1, Math.ceil(max));
  const step = Math.pow(10, Math.floor(Math.log10(max)) - 1) * 2;
  return Math.ceil(max / step) * step;
}
