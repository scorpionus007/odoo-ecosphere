import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getScope } from "@/lib/scope";
import { getSettings } from "@/lib/settings";
import { PageHeader, Card, Table, Th, Td, Chip, EmptyState } from "@/components/ui";
import { decideParticipation } from "../social/actions";
import { decideChallengeParticipation } from "../gamification/actions";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  await requireRole("ADMIN", "MANAGER");
  const scope = await getScope();
  const settings = await getSettings();
  // managers only review submissions from their own department
  const deptFilter = scope.departmentId ? { employee: { departmentId: scope.departmentId } } : {};
  const [csrPending, challengePending] = await Promise.all([
    db.employeeParticipation.findMany({
      where: { approvalStatus: "PENDING", ...deptFilter },
      include: { employee: { include: { department: true } }, activity: true },
      orderBy: { createdAt: "asc" },
    }),
    db.challengeParticipation.findMany({
      where: { approvalStatus: "PENDING", ...deptFilter },
      include: { employee: { include: { department: true } }, challenge: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const DecideButtons = ({
    id,
    action,
    disableApprove,
    disabledHint,
  }: {
    id: string;
    action: (fd: FormData) => Promise<void>;
    disableApprove?: boolean;
    disabledHint?: string;
  }) => (
    <div className="flex items-center gap-2">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="APPROVED" />
        <button
          disabled={disableApprove}
          title={disableApprove ? disabledHint : undefined}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 cursor-pointer"
        >
          Approve
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="REJECTED" />
        <button className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium px-3 py-1.5 cursor-pointer">
          Reject
        </button>
      </form>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle={`${scope.isAdmin ? "All departments" : `${scope.departmentName ?? "Your department"} submissions only`} — pending CSR participations and challenge submissions${
          settings.evidenceRequirement ? " · evidence requirement is ON" : ""
        }`}
      />

      <Card title={`CSR participations (${csrPending.length})`} className="mb-6">
        {csrPending.length === 0 ? (
          <EmptyState message="No pending CSR participations" />
        ) : (
          <Table
            head={
              <>
                <Th>Employee</Th>
                <Th>Activity</Th>
                <Th>Points</Th>
                <Th>Proof</Th>
                <Th>Decision</Th>
              </>
            }
          >
            {csrPending.map((p) => {
              const blocked = settings.evidenceRequirement && !p.proofUrl;
              return (
                <tr key={p.id}>
                  <Td>
                    <div className="font-medium">{p.employee.name}</div>
                    <div className="text-xs text-slate-400">{p.employee.department?.code ?? "—"}</div>
                  </Td>
                  <Td>{p.activity.title}</Td>
                  <Td>{p.activity.pointsReward}</Td>
                  <Td>
                    {p.proofUrl ? (
                      <a href={p.proofUrl} target="_blank" className="text-sky-600 text-xs hover:underline">
                        View proof
                      </a>
                    ) : (
                      <Chip label="No proof" tone={blocked ? "red" : "gray"} />
                    )}
                  </Td>
                  <Td>
                    <DecideButtons
                      id={p.id}
                      action={decideParticipation}
                      disableApprove={blocked}
                      disabledHint="Evidence Requirement is ON — proof file needed before approval"
                    />
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Card title={`Challenge submissions (${challengePending.length})`}>
        {challengePending.length === 0 ? (
          <EmptyState message="No pending challenge submissions" />
        ) : (
          <Table
            head={
              <>
                <Th>Employee</Th>
                <Th>Challenge</Th>
                <Th>Progress</Th>
                <Th>XP</Th>
                <Th>Proof</Th>
                <Th>Decision</Th>
              </>
            }
          >
            {challengePending.map((p) => {
              const blocked = p.challenge.evidenceRequired && !p.proofUrl;
              return (
                <tr key={p.id}>
                  <Td>
                    <div className="font-medium">{p.employee.name}</div>
                    <div className="text-xs text-slate-400">{p.employee.department?.code ?? "—"}</div>
                  </Td>
                  <Td>{p.challenge.title}</Td>
                  <Td>{p.progress}%</Td>
                  <Td>{p.challenge.xp}</Td>
                  <Td>
                    {p.proofUrl ? (
                      <a href={p.proofUrl} target="_blank" className="text-sky-600 text-xs hover:underline">
                        View proof
                      </a>
                    ) : (
                      <Chip label="No proof" tone={blocked ? "red" : "gray"} />
                    )}
                  </Td>
                  <Td>
                    <DecideButtons
                      id={p.id}
                      action={decideChallengeParticipation}
                      disableApprove={blocked}
                      disabledHint="This challenge requires evidence before approval"
                    />
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
