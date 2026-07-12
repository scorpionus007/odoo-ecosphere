"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend, RadialBarChart, RadialBar,
  PolarAngleAxis, AreaChart, Area,
} from "recharts";

export const PALETTE = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#14b8a6", "#6366f1"];

const tooltipStyle = {
  backgroundColor: "rgb(15 23 42)",
  border: "1px solid rgb(51 65 85)",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 12,
};

export function BarBox({
  data, xKey, bars, height = 260, stacked = false,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  bars: { key: string; name?: string; color?: string }[];
  height?: number;
  stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {bars.map((b, i) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.name ?? b.key}
            fill={b.color ?? PALETTE[i % PALETTE.length]}
            radius={[4, 4, 0, 0]}
            stackId={stacked ? "s" : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieBox({
  data, height = 260, donut = true,
}: {
  data: { name: string; value: number }[];
  height?: number;
  donut?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={donut ? "55%" : 0}
          outerRadius="85%"
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function LineBox({
  data, xKey, lines, height = 260,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  lines: { key: string; name?: string; color?: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {lines.map((l, i) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.name ?? l.key}
            stroke={l.color ?? PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AreaBox({
  data, xKey, areaKey, name, height = 220, color = "#10b981",
}: {
  data: Record<string, unknown>[];
  xKey: string;
  areaKey: string;
  name?: string;
  height?: number;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`grad-${areaKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey={areaKey}
          name={name ?? areaKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${areaKey})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ScoreGauge({ value, label, size = 180 }: { value: number; label: string; size?: number }) {
  const color = value >= 70 ? "#10b981" : value >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: size * 0.72 }} className="relative">
        <ResponsiveContainer width="100%" height={size}>
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={[{ value }]}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} fill={color} background={{ fill: "#94a3b830" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-x-0 top-[52%] text-center">
          <div className="text-3xl font-bold" style={{ color }}>
            {value}
          </div>
        </div>
      </div>
      <div className="text-xs uppercase tracking-wide text-slate-500 -mt-4">{label}</div>
    </div>
  );
}
