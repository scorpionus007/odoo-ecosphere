import { db } from "./db";
import { getSettings } from "./settings";

export type DeptScore = {
  departmentId: string;
  name: string;
  code: string;
  envScore: number;
  socialScore: number;
  govScore: number;
  totalScore: number;
  members: number;
  co2eKg: number;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

/**
 * ESG scoring engine (Section 5 workflow).
 * Environmental: lower emissions per employee = higher score, plus goal progress.
 * Social: CSR + challenge participation rate, training completion.
 * Governance: policy acknowledgement rate, minus open/overdue compliance issues.
 * Department Total = weighted average (configurable, default E40/S30/G30).
 */
export async function computeScores(): Promise<{ departments: DeptScore[]; overall: number; weights: { env: number; social: number; gov: number } }> {
  const settings = await getSettings();
  const { weights } = settings;
  const wSum = weights.env + weights.social + weights.gov || 100;

  const departments = await db.department.findMany({
    where: { status: "ACTIVE" },
    include: { members: { where: { status: "ACTIVE" } } },
  });
  const deptIds = departments.map((d) => d.id);

  const [carbon, goals, csrParts, chParts, trainings, policies, acks, issues] = await Promise.all([
    db.carbonTransaction.groupBy({ by: ["departmentId"], _sum: { co2eKg: true } }),
    db.environmentalGoal.findMany(),
    db.employeeParticipation.findMany({ include: { employee: true } }),
    db.challengeParticipation.findMany({ include: { employee: true } }),
    db.trainingRecord.findMany({ include: { employee: true } }),
    db.esgPolicy.count({ where: { status: "ACTIVE", requiresAck: true } }),
    db.policyAcknowledgement.findMany({ include: { employee: true } }),
    db.complianceIssue.findMany({ include: { owner: true } }),
  ]);

  const carbonByDept = new Map(carbon.map((c) => [c.departmentId, c._sum.co2eKg ?? 0]));
  const maxPerCapita = Math.max(
    1,
    ...departments.map((d) => (carbonByDept.get(d.id) ?? 0) / Math.max(1, d.members.length))
  );

  const scores: DeptScore[] = departments.map((d) => {
    const memberIds = new Set(d.members.map((m) => m.id));
    const headcount = Math.max(1, d.members.length);

    // --- Environmental (60% emissions intensity + 40% goal progress) ---
    const co2 = carbonByDept.get(d.id) ?? 0;
    const intensityScore = 100 - ((co2 / headcount) / maxPerCapita) * 100;
    const deptGoals = goals.filter((g) => !g.departmentId || g.departmentId === d.id);
    const goalScore = deptGoals.length
      ? (deptGoals.reduce((acc, g) => {
          const span = Math.abs(g.baseline - g.target) || 1;
          const progress = Math.abs(g.baseline - g.currentValue) / span;
          return acc + Math.min(1, progress);
        }, 0) /
          deptGoals.length) *
        100
      : 50;
    const envScore = clamp(intensityScore * 0.6 + goalScore * 0.4);

    // --- Social (participation rate + training completion) ---
    const participants = new Set([
      ...csrParts.filter((p) => memberIds.has(p.employeeId) && p.approvalStatus === "APPROVED").map((p) => p.employeeId),
      ...chParts.filter((p) => memberIds.has(p.employeeId) && p.approvalStatus === "APPROVED").map((p) => p.employeeId),
    ]);
    const participationRate = (participants.size / headcount) * 100;
    const deptTrainings = trainings.filter((t) => memberIds.has(t.employeeId));
    const trainingRate = deptTrainings.length
      ? (deptTrainings.filter((t) => t.status === "COMPLETED").length / deptTrainings.length) * 100
      : 50;
    const socialScore = clamp(participationRate * 0.6 + trainingRate * 0.4);

    // --- Governance (ack rate − issue penalties) ---
    const ackRate = policies
      ? (acks.filter((a) => memberIds.has(a.employeeId)).length / (policies * headcount)) * 100
      : 100;
    const deptIssues = issues.filter((i) => i.owner.departmentId === d.id);
    const now = new Date();
    const penalty = deptIssues.reduce((acc, i) => {
      if (i.status === "RESOLVED" || i.status === "CLOSED") return acc;
      const overdue = i.dueDate < now;
      const sev = { LOW: 2, MEDIUM: 5, HIGH: 10, CRITICAL: 15 }[i.severity] ?? 5;
      return acc + sev * (overdue ? 2 : 1);
    }, 0);
    const govScore = clamp(ackRate - penalty);

    const totalScore = clamp(
      (envScore * weights.env + socialScore * weights.social + govScore * weights.gov) / wSum
    );

    return {
      departmentId: d.id,
      name: d.name,
      code: d.code,
      envScore,
      socialScore,
      govScore,
      totalScore,
      members: d.members.length,
      co2eKg: co2,
    };
  });

  // Persist DepartmentScore snapshots for the current period
  const period = new Date().toISOString().slice(0, 7);
  for (const s of scores) {
    await db.departmentScore.upsert({
      where: { departmentId_period: { departmentId: s.departmentId, period } },
      create: {
        departmentId: s.departmentId,
        period,
        envScore: s.envScore,
        socialScore: s.socialScore,
        govScore: s.govScore,
        totalScore: s.totalScore,
      },
      update: {
        envScore: s.envScore,
        socialScore: s.socialScore,
        govScore: s.govScore,
        totalScore: s.totalScore,
      },
    });
  }

  // Overall ESG Score = weighted average of Department Total Scores (weighted by headcount)
  const totalMembers = scores.reduce((a, s) => a + Math.max(1, s.members), 0) || 1;
  const overall = clamp(
    scores.reduce((a, s) => a + s.totalScore * Math.max(1, s.members), 0) / totalMembers
  );

  return { departments: scores.sort((a, b) => b.totalScore - a.totalScore), overall, weights };
}
