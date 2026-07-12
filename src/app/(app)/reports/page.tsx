import Link from "next/link";
import { db } from "@/lib/db";
import { getScope } from "@/lib/scope";
import { buildReport, ReportFilters } from "@/lib/report";
import { PageHeader, Card, Table, Th, Td, Field, inputCls, btnPrimary, btnSecondary, EmptyState } from "@/components/ui";
import { Leaf, HeartHandshake, Scale, Trophy, FileSpreadsheet, FileText, FileDown } from "lucide-react";

export const dynamic = "force-dynamic";

const PRESETS = [
  { module: "ENVIRONMENTAL", label: "Environmental Report", icon: <Leaf size={18} />, desc: "Carbon transactions & emissions" },
  { module: "SOCIAL", label: "Social Report", icon: <HeartHandshake size={18} />, desc: "CSR participation & points" },
  { module: "GOVERNANCE", label: "Governance Report", icon: <Scale size={18} />, desc: "Compliance issues & audits" },
  { module: "SUMMARY", label: "ESG Summary Report", icon: <Trophy size={18} />, desc: "Weighted department scores" },
] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const scope = await getScope();
  const filters: ReportFilters = {
    module: (sp.module as ReportFilters["module"]) || "SUMMARY",
    // non-admins are pinned to their own department, whatever the URL says
    departmentId: scope.departmentId ?? (sp.departmentId || undefined),
    employeeId: sp.employeeId || undefined,
    challengeId: sp.challengeId || undefined,
    esgCategory: (sp.esgCategory as ReportFilters["esgCategory"]) || "",
    dateFrom: sp.dateFrom || undefined,
    dateTo: sp.dateTo || undefined,
  };

  const [report, departments, employees, challenges] = await Promise.all([
    buildReport(filters),
    db.department.findMany({
      where: scope.departmentId ? { id: scope.departmentId } : {},
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { status: "ACTIVE", ...(scope.departmentId ? { departmentId: scope.departmentId } : {}) },
      orderBy: { name: "asc" },
    }),
    db.challenge.findMany({ orderBy: { title: "asc" } }),
  ]);

  const qs = new URLSearchParams(
    Object.entries({ ...sp, module: filters.module }).filter(([, v]) => v) as [string, string][]
  ).toString();

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Standard module reports and a custom report builder — export as PDF, Excel or CSV"
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        {PRESETS.map((p) => (
          <Link key={p.module} href={`/reports?module=${p.module}`}>
            <div
              className={`rounded-xl border p-4 flex items-center gap-3 transition-colors bg-white dark:bg-slate-900 hover:border-emerald-400 ${
                filters.module === p.module
                  ? "border-emerald-500 ring-1 ring-emerald-500/40"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                {p.icon}
              </div>
              <div>
                <div className="font-semibold text-sm">{p.label}</div>
                <div className="text-[11px] text-slate-400">{p.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Card title="Custom report builder" className="mb-6">
        <form method="GET" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <Field label="Module">
            <select name="module" defaultValue={filters.module} className={inputCls}>
              <option value="SUMMARY">ESG Summary</option>
              <option value="ENVIRONMENTAL">Environmental</option>
              <option value="SOCIAL">Social</option>
              <option value="GOVERNANCE">Governance</option>
              <option value="GAMIFICATION">Gamification</option>
            </select>
          </Field>
          <Field label={scope.isAdmin ? "Department" : "Department (locked to yours)"}>
            <select
              name="departmentId"
              defaultValue={filters.departmentId ?? ""}
              disabled={!scope.isAdmin}
              className={`${inputCls} disabled:opacity-60`}
            >
              {scope.isAdmin && <option value="">All departments</option>}
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Employee">
            <select name="employeeId" defaultValue={filters.employeeId ?? ""} className={inputCls}>
              <option value="">All employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Challenge">
            <select name="challengeId" defaultValue={filters.challengeId ?? ""} className={inputCls}>
              <option value="">All challenges</option>
              {challenges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ESG category">
            <select name="esgCategory" defaultValue={filters.esgCategory ?? ""} className={inputCls}>
              <option value="">All (E+S+G)</option>
              <option value="E">Environmental</option>
              <option value="S">Social</option>
              <option value="G">Governance</option>
            </select>
          </Field>
          <Field label="From">
            <input type="date" name="dateFrom" defaultValue={filters.dateFrom} className={inputCls} />
          </Field>
          <Field label="To">
            <input type="date" name="dateTo" defaultValue={filters.dateTo} className={inputCls} />
          </Field>
          <button className={btnPrimary}>Build report</button>
        </form>
      </Card>

      <Card
        title={report.title}
        className="mb-2"
      >
        <div className="flex flex-wrap gap-2 mb-4 no-print">
          <a href={`/api/reports/export?${qs}&format=pdf`} className={btnSecondary}>
            <FileText size={14} /> Export PDF
          </a>
          <a href={`/api/reports/export?${qs}&format=xlsx`} className={btnSecondary}>
            <FileSpreadsheet size={14} /> Export Excel
          </a>
          <a href={`/api/reports/export?${qs}&format=csv`} className={btnSecondary}>
            <FileDown size={14} /> Export CSV
          </a>
          <span className="text-xs text-slate-400 self-center ml-2">
            {report.rows.length} row{report.rows.length === 1 ? "" : "s"}
          </span>
        </div>
        {report.rows.length === 0 ? (
          <EmptyState message="No data matches these filters" />
        ) : (
          <Table head={<>{report.columns.map((c) => <Th key={c}>{c}</Th>)}</>}>
            {report.rows.map((row, i) => (
              <tr key={i} className={String(row[0]).startsWith("OVERALL") ? "font-bold bg-emerald-50/50 dark:bg-emerald-950/30" : ""}>
                {row.map((cell, j) => (
                  <Td key={j}>{cell}</Td>
                ))}
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
