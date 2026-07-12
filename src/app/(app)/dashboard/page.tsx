import Link from "next/link";
import { db } from "@/lib/db";
import { computeScores } from "@/lib/scoring";
import { getScope } from "@/lib/scope";
import { levelFromXp } from "@/lib/game";
import { PageHeader, Card, StatCard, Chip, Table, Th, Td } from "@/components/ui";
import { BarBox, PieBox, ScoreGauge, AreaBox } from "@/components/charts";
import { Leaf, HeartHandshake, Scale, Trophy, Flame, ShieldAlert, Gamepad2, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const scope = await getScope();
  const { user: session, isAdmin, deptWhere, departmentName } = scope;
  const me = await db.user.findUnique({ where: { id: session.id } });
  const [scoreData, totalCo2, activeChallenges, openIssues, csrCount, txByMonthRaw, txBySourceRaw] =
    await Promise.all([
      computeScores(),
      db.carbonTransaction.aggregate({ where: deptWhere, _sum: { co2eKg: true } }),
      db.challenge.count({ where: { status: "ACTIVE" } }),
      db.complianceIssue.count({
        where: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
          ...(scope.departmentId ? { owner: { departmentId: scope.departmentId } } : {}),
        },
      }),
      db.csrActivity.count(),
      db.carbonTransaction.findMany({
        where: deptWhere,
        select: { date: true, co2eKg: true },
        orderBy: { date: "asc" },
      }),
      db.carbonTransaction.groupBy({ by: ["source"], where: deptWhere, _sum: { co2eKg: true } }),
    ]);

  // non-admins see only their own department's scores and rankings
  const departments = isAdmin
    ? scoreData.departments
    : scoreData.departments.filter((d) => d.departmentId === scope.departmentId);
  const weights = scoreData.weights;
  const overall = isAdmin ? scoreData.overall : departments[0]?.totalScore ?? 0;
  const txBySource = txBySourceRaw;

  // emissions trend by month
  const byMonth = new Map<string, number>();
  for (const t of txByMonthRaw) {
    const k = t.date.toISOString().slice(0, 7);
    byMonth.set(k, (byMonth.get(k) ?? 0) + t.co2eKg);
  }
  const trend = [...byMonth.entries()].map(([month, co2e]) => ({
    month,
    co2e: Math.round(co2e),
  }));

  const sourceData = txBySource.map((s) => ({
    name: s.source.charAt(0) + s.source.slice(1).toLowerCase(),
    value: Math.round(s._sum.co2eKg ?? 0),
  }));

  const avg = (k: "envScore" | "socialScore" | "govScore") =>
    departments.length
      ? Math.round((departments.reduce((a, d) => a + d[k], 0) / departments.length) * 10) / 10
      : 0;

  return (
    <>
      <PageHeader
        title={isAdmin ? "Organization ESG Dashboard" : `${departmentName ?? "My"} Department Dashboard`}
        subtitle={
          isAdmin
            ? `Overall score = weighted avg of department scores (E ${weights.env}% / S ${weights.social}% / G ${weights.gov}%)`
            : `Your department's ESG performance (weights E ${weights.env}% / S ${weights.social}% / G ${weights.gov}%) — organization-wide data is admin-only`
        }
      />

      <Link href="/quest" className="block mb-6 group">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white p-4 sm:p-5 flex items-center gap-4 shadow-lg group-hover:shadow-xl transition-shadow overflow-hidden relative">
          <div className="absolute -right-4 -top-6 text-8xl opacity-15 rotate-12">🌳</div>
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Gamepad2 size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold">
              Continue your quest, {session.name.split(" ")[0]} — Level {levelFromXp(me?.xpTotal ?? 0)} Eco Hero
            </div>
            <div className="text-sm text-emerald-100">
              {activeChallenges} active quest{activeChallenges === 1 ? "" : "s"} in the village ·{" "}
              {me?.pointsBalance ?? 0} 🪙 to spend at the Trading Post
            </div>
          </div>
          <ChevronRight className="shrink-0 group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard label={isAdmin ? "Overall ESG" : "Dept ESG"} value={overall} icon={<Trophy size={18} />} tone="emerald" hint="/ 100" />
        <StatCard label="Environmental" value={avg("envScore")} icon={<Leaf size={18} />} tone="emerald" />
        <StatCard label="Social" value={avg("socialScore")} icon={<HeartHandshake size={18} />} tone="sky" />
        <StatCard label="Governance" value={avg("govScore")} icon={<Scale size={18} />} tone="violet" />
        <StatCard
          label="Total CO₂e"
          value={`${Math.round((totalCo2._sum.co2eKg ?? 0) / 100) / 10} t`}
          icon={<Flame size={18} />}
          tone="amber"
        />
        <StatCard label="Open Issues" value={openIssues} icon={<ShieldAlert size={18} />} tone="rose" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card title={isAdmin ? "Overall ESG Score" : `${departmentName} ESG Score`}>
          <div className="flex items-center justify-center py-2">
            <ScoreGauge value={overall} label="Weighted score" size={220} />
          </div>
          <div className="text-xs text-slate-400 text-center">
            {csrCount} CSR activities · {activeChallenges} active challenges
          </div>
        </Card>
        <Card title={isAdmin ? "Department ESG comparison" : "Your department E / S / G breakdown"} className="lg:col-span-2">
          <BarBox
            data={departments.map((d) => ({
              dept: d.code,
              Environmental: d.envScore,
              Social: d.socialScore,
              Governance: d.govScore,
            }))}
            xKey="dept"
            bars={[
              { key: "Environmental", color: "#10b981" },
              { key: "Social", color: "#0ea5e9" },
              { key: "Governance", color: "#8b5cf6" },
            ]}
          />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card title="Emissions trend (kgCO₂e / month)">
          <AreaBox data={trend} xKey="month" areaKey="co2e" name="kgCO₂e" />
        </Card>
        <Card title="Emissions by source module">
          <PieBox data={sourceData} height={220} />
        </Card>
      </div>

      <Card title={isAdmin ? "Department ESG rankings" : "Your department scorecard"}>
        <Table
          head={
            <>
              <Th>#</Th>
              <Th>Department</Th>
              <Th>Members</Th>
              <Th>CO₂e (kg)</Th>
              <Th>Environmental</Th>
              <Th>Social</Th>
              <Th>Governance</Th>
              <Th>Total</Th>
            </>
          }
        >
          {departments.map((d, i) => (
            <tr key={d.departmentId}>
              <Td className="font-bold text-slate-400">{i + 1}</Td>
              <Td className="font-medium">
                {d.name} <span className="text-xs text-slate-400">({d.code})</span>
              </Td>
              <Td>{d.members}</Td>
              <Td>{Math.round(d.co2eKg).toLocaleString()}</Td>
              <Td>
                <Chip label={String(d.envScore)} tone={d.envScore >= 70 ? "green" : d.envScore >= 40 ? "amber" : "red"} />
              </Td>
              <Td>
                <Chip label={String(d.socialScore)} tone={d.socialScore >= 70 ? "green" : d.socialScore >= 40 ? "amber" : "red"} />
              </Td>
              <Td>
                <Chip label={String(d.govScore)} tone={d.govScore >= 70 ? "green" : d.govScore >= 40 ? "amber" : "red"} />
              </Td>
              <Td className="font-bold">{d.totalScore}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
