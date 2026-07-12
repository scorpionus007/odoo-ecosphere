import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ${className}`}
    >
      {title && (
        <div className="px-5 pt-4 pb-0 font-semibold text-sm text-slate-700 dark:text-slate-200">
          {title}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "emerald",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "emerald" | "sky" | "violet" | "amber" | "rose" | "slate";
}) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 flex items-center gap-3">
      {icon && (
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-lg ${tones[tone]}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="text-xl font-bold truncate">{value}</div>
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </div>
    </div>
  );
}

const chipTones: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  red: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  blue: "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200",
  gray: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function statusTone(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "green", APPROVED: "green", COMPLETED: "green", RESOLVED: "green", CLOSED: "green",
    ACHIEVED: "green", FULFILLED: "green", ONGOING: "blue", IN_PROGRESS: "blue", DISPATCHED: "blue",
    UPCOMING: "blue", PLANNED: "blue", UNDER_REVIEW: "violet", PENDING: "amber", DRAFT: "gray",
    OPEN: "amber", INACTIVE: "gray", ARCHIVED: "gray", REJECTED: "red", CANCELLED: "red",
    MISSED: "red", SUSPENDED: "red", LOW: "gray", MEDIUM: "amber", HIGH: "red", CRITICAL: "red",
    EASY: "green", HARD: "red",
  };
  return map[status] ?? "gray";
}

export function Chip({ label, tone }: { label: string; tone?: string }) {
  const t = tone ?? statusTone(label);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${chipTones[t] ?? chipTones.gray}`}
    >
      {label.replaceAll("_", " ")}
    </span>
  );
}

export function ProgressBar({ value, tone = "emerald" }: { value: number; tone?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const tones: Record<string, string> = {
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    violet: "bg-violet-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };
  return (
    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
      <div className={`h-full rounded-full ${tones[tone] ?? tones.emerald}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-500">{message}</div>
  );
}

/** Advisory AI evidence-verification badge (Gemini pre-screen). Renders nothing without a verdict. */
export function AiBadge({
  verdict,
  confidence,
  reason,
}: {
  verdict: string | null;
  confidence: number | null;
  reason: string | null;
}) {
  if (!verdict) return null;
  const styles: Record<string, { cls: string; icon: string; label: string }> = {
    SUPPORTED: {
      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700",
      icon: "✓",
      label: "AI: consistent",
    },
    INCONSISTENT: {
      cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 border-rose-300 dark:border-rose-700",
      icon: "✗",
      label: "AI: mismatch",
    },
    UNCLEAR: {
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border-amber-300 dark:border-amber-700",
      icon: "?",
      label: "AI: unclear",
    },
  };
  const s = styles[verdict] ?? styles.UNCLEAR;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap cursor-help ${s.cls}`}
      title={`${reason ?? ""} (advisory pre-screen — final decision is yours)`}
    >
      {s.icon} {s.label}
      {typeof confidence === "number" && ` ${confidence}%`}
    </span>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 px-4 py-2.5 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 text-sm align-middle ${className}`}>{children}</td>;
}

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full">
        <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">{children}</tbody>
      </table>
    </div>
  );
}

// ---- form primitives ----
export const inputCls =
  "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</span>
      {children}
    </label>
  );
}

export const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 transition-colors disabled:opacity-50 cursor-pointer";
export const btnSecondary =
  "inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium px-4 py-2 transition-colors cursor-pointer";
export const btnDanger =
  "inline-flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-3 py-1.5 transition-colors cursor-pointer";
