import { db } from "@/lib/db";
import { getScope } from "@/lib/scope";
import { PageHeader, Card, StatCard, ProgressBar, Chip } from "@/components/ui";
import { BarBox, PieBox } from "@/components/charts";
import { Flame, Factory, Target, Globe2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EnvDashboard() {
  const scope = await getScope();
  const { isAdmin, deptWhere, departmentName } = scope;
  const [txs, goals, factors, byDept, byScope] = await Promise.all([
    db.carbonTransaction.aggregate({ where: deptWhere, _sum: { co2eKg: true }, _count: true }),
    db.environmentalGoal.findMany({
      // non-admins: their department's goals + org-wide goals
      where: isAdmin ? {} : { OR: [{ departmentId: scope.departmentId }, { departmentId: null }] },
      include: { department: true },
      orderBy: { deadline: "asc" },
    }),
    db.emissionFactor.count({ where: { status: "ACTIVE" } }),
    db.carbonTransaction.groupBy({ by: ["departmentId"], where: deptWhere, _sum: { co2eKg: true } }),
    db.carbonTransaction.findMany({ where: deptWhere, include: { emissionFactor: true } }),
  ]);

  const departments = await db.department.findMany();
  const deptName = (id: string) => departments.find((d) => d.id === id)?.code ?? "?";
  const deptData = byDept.map((d) => ({
    dept: deptName(d.departmentId),
    co2e: Math.round(d._sum.co2eKg ?? 0),
  }));

  const scopeAgg = new Map<number, number>();
  for (const t of byScope) {
    scopeAgg.set(t.emissionFactor.scope, (scopeAgg.get(t.emissionFactor.scope) ?? 0) + t.co2eKg);
  }
  const scopeData = [...scopeAgg.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([scope, v]) => ({ name: `Scope ${scope}`, value: Math.round(v) }));

  return (
    <>
      <PageHeader
        title="Environmental Dashboard"
        subtitle={
          isAdmin
            ? "Carbon accounting, department tracking and sustainability goals"
            : `Carbon accounting and goals for ${departmentName ?? "your department"}`
        }
      />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total emissions"
          value={`${Math.round(txs._sum.co2eKg ?? 0).toLocaleString()} kg`}
          hint="CO₂e all-time"
          icon={<Flame size={18} />}
          tone="amber"
        />
        <StatCard label="Carbon transactions" value={txs._count} icon={<Factory size={18} />} tone="sky" />
        <StatCard
          label="Active goals"
          value={goals.filter((g) => g.status === "ACTIVE").length}
          icon={<Target size={18} />}
          tone="emerald"
        />
        <StatCard label="Active emission factors" value={factors} icon={<Globe2 size={18} />} tone="violet" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card title="Department carbon tracking (kgCO₂e)">
          <BarBox data={deptData} xKey="dept" bars={[{ key: "co2e", name: "kgCO₂e", color: "#f59e0b" }]} />
        </Card>
        <Card title="Emissions by GHG scope">
          <PieBox data={scopeData} />
        </Card>
      </div>

      <Card title="Sustainability goals">
        <div className="space-y-4">
          {goals.map((g) => {
            const span = Math.abs(g.baseline - g.target) || 1;
            const progress = Math.min(100, Math.round((Math.abs(g.baseline - g.currentValue) / span) * 100));
            return (
              <div key={g.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="font-medium text-sm">
                    {g.title}
                    <span className="text-xs text-slate-400 ml-2">
                      {g.department ? g.department.name : "Organization-wide"} · due{" "}
                      {g.deadline.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {g.currentValue} / {g.target} {g.unit}
                    <Chip label={g.status} />
                  </div>
                </div>
                <ProgressBar value={progress} tone={g.status === "MISSED" ? "rose" : "emerald"} />
              </div>
            );
          })}
          {goals.length === 0 && (
            <div className="text-sm text-slate-400 text-center py-6">No goals yet</div>
          )}
        </div>
      </Card>
    </>
  );
}
