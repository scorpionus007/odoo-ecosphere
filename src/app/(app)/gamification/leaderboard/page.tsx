import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Table, Th, Td, Chip } from "@/components/ui";
import { Crown, Medal } from "lucide-react";

export const dynamic = "force-dynamic";

const rankBadge = (i: number) =>
  i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;

export default async function LeaderboardPage() {
  const user = await requireUser();
  const [users, deptScores] = await Promise.all([
    db.user.findMany({
      where: { status: "ACTIVE" },
      include: { department: true, badges: { include: { badge: true } }, challengeEntries: true },
      orderBy: { xpTotal: "desc" },
      take: 50,
    }),
    db.departmentScore.findMany({
      where: { period: new Date().toISOString().slice(0, 7) },
      include: { department: true },
      orderBy: { totalScore: "desc" },
    }),
  ]);

  return (
    <>
      <PageHeader title="Leaderboards" subtitle="Individual XP rankings and department ESG standings" />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card title="Employee XP leaderboard">
            <Table
              head={
                <>
                  <Th>#</Th>
                  <Th>Employee</Th>
                  <Th>Department</Th>
                  <Th>Badges</Th>
                  <Th>Challenges done</Th>
                  <Th>XP</Th>
                </>
              }
            >
              {users.map((u, i) => (
                <tr key={u.id} className={u.id === user.id ? "bg-emerald-50/60 dark:bg-emerald-950/30" : ""}>
                  <Td className="text-lg w-12">{rankBadge(i)}</Td>
                  <Td>
                    <div className="font-medium flex items-center gap-2">
                      {u.name}
                      {u.id === user.id && <Chip label="You" tone="green" />}
                    </div>
                  </Td>
                  <Td>{u.department?.code ?? "—"}</Td>
                  <Td>
                    <span className="text-base">{u.badges.map((b) => b.badge.icon).join(" ") || "—"}</span>
                  </Td>
                  <Td>{u.challengeEntries.filter((c) => c.approvalStatus === "APPROVED").length}</Td>
                  <Td className="font-bold text-violet-600 dark:text-violet-300">{u.xpTotal}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>

        <Card title="Department ESG rankings">
          <div className="space-y-3">
            {deptScores.map((d, i) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-800 p-3"
              >
                <div className="text-xl w-8 text-center">{rankBadge(i)}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{d.department.name}</div>
                  <div className="text-[11px] text-slate-400">
                    E {d.envScore} · S {d.socialScore} · G {d.govScore}
                  </div>
                </div>
                <div className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                  {i === 0 ? <Crown size={14} /> : <Medal size={14} />}
                  {d.totalScore}
                </div>
              </div>
            ))}
            {deptScores.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-4">
                Scores compute when the ESG dashboard is visited
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
