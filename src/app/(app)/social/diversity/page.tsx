import { db } from "@/lib/db";
import { getScope } from "@/lib/scope";
import { PageHeader, Card, StatCard, Table, Th, Td } from "@/components/ui";
import { PieBox, BarBox } from "@/components/charts";
import { Users, UserCheck, GraduationCap, HeartHandshake } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DiversityPage() {
  const scope = await getScope();
  const { departmentId } = scope;
  const [users, departments, trainings, volunteerAgg] = await Promise.all([
    db.user.findMany({
      where: { status: "ACTIVE", ...(departmentId ? { departmentId } : {}) },
      include: { department: true },
    }),
    db.department.findMany({
      where: { status: "ACTIVE", ...(departmentId ? { id: departmentId } : {}) },
      include: { members: true },
    }),
    db.trainingRecord.findMany({
      where: departmentId ? { employee: { departmentId } } : {},
    }),
    db.employeeParticipation.aggregate({
      where: {
        approvalStatus: "APPROVED",
        ...(departmentId ? { employee: { departmentId } } : {}),
      },
      _sum: { hoursVolunteered: true },
    }),
  ]);
  const volunteerHours = Math.round((volunteerAgg._sum.hoursVolunteered ?? 0) * 10) / 10;

  const genderCounts = new Map<string, number>();
  for (const u of users) {
    const g = u.gender ?? "UNDISCLOSED";
    genderCounts.set(g, (genderCounts.get(g) ?? 0) + 1);
  }
  const genderData = [...genderCounts.entries()].map(([name, value]) => ({
    name: name.charAt(0) + name.slice(1).toLowerCase(),
    value,
  }));

  const femalePct = users.length
    ? Math.round(((genderCounts.get("FEMALE") ?? 0) / users.length) * 100)
    : 0;

  const deptGender = departments.map((d) => {
    const f = d.members.filter((m) => m.gender === "FEMALE").length;
    const m = d.members.filter((m) => m.gender === "MALE").length;
    const o = d.members.length - f - m;
    return { dept: d.code, Female: f, Male: m, Other: o };
  });

  const trainingDone = trainings.filter((t) => t.status === "COMPLETED").length;
  const trainingRate = trainings.length ? Math.round((trainingDone / trainings.length) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Diversity Metrics"
        subtitle={
          scope.isAdmin
            ? "Workforce composition and inclusion indicators"
            : `Composition for ${scope.departmentName ?? "your department"}`
        }
      />
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
        <StatCard label="Active employees" value={users.length} icon={<Users size={18} />} tone="sky" />
        <StatCard label="Women in workforce" value={`${femalePct}%`} icon={<UserCheck size={18} />} tone="violet" />
        <StatCard label="Departments" value={departments.length} icon={<Users size={18} />} tone="emerald" />
        <StatCard label="Training completion" value={`${trainingRate}%`} icon={<GraduationCap size={18} />} tone="amber" />
        <StatCard label="Volunteer hours" value={volunteerHours} hint="approved CSR" icon={<HeartHandshake size={18} />} tone="rose" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card title="Gender distribution">
          <PieBox data={genderData} />
        </Card>
        <Card title="Gender by department">
          <BarBox
            data={deptGender}
            xKey="dept"
            stacked
            bars={[
              { key: "Female", color: "#8b5cf6" },
              { key: "Male", color: "#0ea5e9" },
              { key: "Other", color: "#f59e0b" },
            ]}
          />
        </Card>
      </div>
      <Card title="Department composition">
        <Table
          head={
            <>
              <Th>Department</Th>
              <Th>Members</Th>
              <Th>Female</Th>
              <Th>Male</Th>
              <Th>Female %</Th>
            </>
          }
        >
          {departments.map((d) => {
            const f = d.members.filter((m) => m.gender === "FEMALE").length;
            const pct = d.members.length ? Math.round((f / d.members.length) * 100) : 0;
            return (
              <tr key={d.id}>
                <Td className="font-medium">{d.name}</Td>
                <Td>{d.members.length}</Td>
                <Td>{f}</Td>
                <Td>{d.members.filter((m) => m.gender === "MALE").length}</Td>
                <Td>{pct}%</Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
