import Link from "next/link";
import { db } from "@/lib/db";
import { getScope } from "@/lib/scope";
import { PageHeader, Card, StatCard, ProgressBar, Chip } from "@/components/ui";
import { PieBox, BarBox } from "@/components/charts";
import { ScrollText, FileCheck2, ShieldAlert, Clock, ShieldCheck, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GovernanceDashboard() {
  const scope = await getScope();
  const { isAdmin, departmentId, departmentName } = scope;
  const now = new Date();

  const [policies, acks, audits, issues, assignments] = await Promise.all([
    db.esgPolicy.findMany({
      where: isAdmin ? {} : { OR: [{ departmentId: null }, { departmentId }] },
    }),
    db.policyAcknowledgement.findMany({
      where: departmentId ? { employee: { departmentId } } : {},
    }),
    db.audit.findMany({
      where: isAdmin ? {} : { OR: [{ departmentId: null }, { departmentId }] },
    }),
    db.complianceIssue.findMany({
      where: departmentId ? { owner: { departmentId } } : {},
    }),
    db.complianceAssignment.findMany({
      where: departmentId ? { departmentId } : {},
      include: { department: true },
    }),
  ]);

  const ackDone = acks.filter((a) => a.status === "ACKNOWLEDGED").length;
  const ackRate = acks.length ? Math.round((ackDone / acks.length) * 100) : 100;

  const auditByStatus = ["PLANNED", "IN_PROGRESS", "COMPLETED"].map((s) => ({
    name: s.replaceAll("_", " "),
    value: audits.filter((a) => a.status === s).length,
  }));

  const openIssues = issues.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS");
  const resolvedIssues = issues.length - openIssues.length;
  const overdueIssues = openIssues.filter((i) => i.dueDate < now).length;

  const compliant = assignments.filter((a) => a.status === "COMPLIANT").length;
  const complianceRate = assignments.length ? Math.round((compliant / assignments.length) * 100) : 0;
  const overdueAssignments = assignments.filter(
    (a) => a.status !== "COMPLIANT" && a.dueDate && a.dueDate < now
  ).length;

  // per-department compliance progress (admin only, else single dept)
  const deptAgg = new Map<string, { done: number; total: number }>();
  for (const a of assignments) {
    const key = a.department.code;
    const cur = deptAgg.get(key) ?? { done: 0, total: 0 };
    cur.total++;
    if (a.status === "COMPLIANT") cur.done++;
    deptAgg.set(key, cur);
  }
  const deptData = [...deptAgg.entries()].map(([dept, v]) => ({
    dept,
    Compliant: v.done,
    Open: v.total - v.done,
  }));

  return (
    <>
      <PageHeader
        title={isAdmin ? "Governance Dashboard" : `Governance — ${departmentName ?? "My department"}`}
        subtitle="Policies, acknowledgements, audits, compliance issues and standards coverage at a glance"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard label="Policies" value={policies.length} icon={<ScrollText size={18} />} tone="violet" />
        <StatCard label="Acknowledged" value={`${ackRate}%`} hint={`${ackDone}/${acks.length} records`} icon={<FileCheck2 size={18} />} tone="emerald" />
        <StatCard label="Audits" value={audits.length} icon={<FileCheck2 size={18} />} tone="sky" />
        <StatCard label="Open issues" value={openIssues.length} hint={`${resolvedIssues} resolved`} icon={<ShieldAlert size={18} />} tone="amber" />
        <StatCard label="Overdue issues" value={overdueIssues} icon={<Clock size={18} />} tone="rose" />
        <StatCard label="Standards compliant" value={`${complianceRate}%`} hint={`${overdueAssignments} overdue`} icon={<ShieldCheck size={18} />} tone="emerald" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card title="Audits by status">
          <PieBox data={auditByStatus.filter((d) => d.value > 0)} height={220} />
        </Card>
        <Card title="Compliance issues">
          <PieBox
            data={[
              { name: "Open", value: openIssues.length },
              { name: "Resolved/Closed", value: resolvedIssues },
            ].filter((d) => d.value > 0)}
            height={220}
          />
        </Card>
        <Card title="Policy acknowledgement">
          <div className="flex flex-col justify-center h-[220px] gap-3">
            <div className="text-4xl font-bold text-center">{ackRate}%</div>
            <ProgressBar value={ackRate} tone={ackRate >= 80 ? "emerald" : ackRate >= 40 ? "amber" : "rose"} />
            <div className="text-xs text-slate-400 text-center">
              {ackDone} acknowledged · {acks.length - ackDone} pending
            </div>
          </div>
        </Card>
      </div>

      {deptData.length > 0 && (
        <Card title="Standards compliance by department" className="mb-6">
          <BarBox
            data={deptData}
            xKey="dept"
            stacked
            bars={[
              { key: "Compliant", color: "#10b981" },
              { key: "Open", color: "#f59e0b" },
            ]}
            height={220}
          />
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: "/governance/policies", label: "ESG Policies", desc: "Lifecycle + acknowledgements" },
          { href: "/governance/standards", label: "Compliance Standards", desc: "ISO 14001 · SEBI BRSR · GRI" },
          { href: "/governance/audits", label: "Audits", desc: "Cycles & findings" },
          { href: "/governance/issues", label: "Compliance Issues", desc: "Owners, due dates, overdue" },
        ].map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="hover:border-emerald-400 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">{l.label}</div>
                  <div className="text-xs text-slate-400">{l.desc}</div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
