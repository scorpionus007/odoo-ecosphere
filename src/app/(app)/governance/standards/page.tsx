import { db } from "@/lib/db";
import { getScope } from "@/lib/scope";
import { PageHeader, Card, Table, Th, Td, Chip, Field, inputCls, btnPrimary, StatCard, EmptyState } from "@/components/ui";
import { assignRequirements, updateAssignment } from "../actions";
import FileUploadField from "@/components/FileUploadField";
import { ShieldCheck, ClipboardList, Clock, BadgeCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const STANDARD_LABEL: Record<string, string> = {
  ISO_14001: "ISO 14001 — Environmental Management",
  SEBI_BRSR: "SEBI BRSR — Business Responsibility & Sustainability",
  GRI: "GRI Standards — Sustainability Reporting",
};

export default async function StandardsPage() {
  const scope = await getScope();
  const { isAdmin, user } = scope;

  const [requirements, assignments, departments, managers] = await Promise.all([
    db.complianceRequirement.findMany({ orderBy: [{ standard: "asc" }, { code: "asc" }] }),
    db.complianceAssignment.findMany({
      // managers/employees: only their department's assignments
      where: scope.departmentId ? { departmentId: scope.departmentId } : {},
      include: { requirement: true, department: true, owner: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
    db.department.findMany({ where: { status: "ACTIVE" } }),
    db.user.findMany({ where: { status: "ACTIVE", role: { in: ["MANAGER", "ADMIN"] } }, include: { department: true } }),
  ]);

  const now = new Date();
  const open = assignments.filter((a) => a.status !== "COMPLIANT");
  const overdue = open.filter((a) => a.dueDate && a.dueDate < now);
  const compliant = assignments.filter((a) => a.status === "COMPLIANT");
  const grouped = new Map<string, typeof requirements>();
  for (const r of requirements) {
    grouped.set(r.standard, [...(grouped.get(r.standard) ?? []), r]);
  }

  return (
    <>
      <PageHeader
        title="Compliance Standards"
        subtitle={
          isAdmin
            ? "Built-in ISO 14001 / SEBI BRSR / GRI checklists — assign requirements to a department's manager; proof upload is required to close"
            : `${scope.departmentName ?? "Your department"}'s assigned compliance requirements — upload proof to mark compliant`
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <StatCard label="Requirements library" value={requirements.length} icon={<ClipboardList size={18} />} tone="sky" />
        <StatCard label="Assigned (in scope)" value={assignments.length} icon={<ShieldCheck size={18} />} tone="violet" />
        <StatCard label="Compliant" value={compliant.length} icon={<BadgeCheck size={18} />} tone="emerald" />
        <StatCard label="Overdue" value={overdue.length} icon={<Clock size={18} />} tone="rose" />
      </div>

      {isAdmin && (
        <Card title="Assign requirements (checkbox activity)" className="mb-6">
          <form action={assignRequirements} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Department">
                <select name="departmentId" required className={inputCls}>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Responsible manager">
                <select name="ownerId" required className={inputCls}>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.department?.code ?? "—"})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Due date">
                <input name="dueDate" type="date" className={inputCls} />
              </Field>
            </div>
            <div className="grid lg:grid-cols-3 gap-4">
              {[...grouped.entries()].map(([standard, reqs]) => (
                <div key={standard} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <div className="font-semibold text-sm mb-2">{STANDARD_LABEL[standard] ?? standard}</div>
                  <div className="space-y-1.5">
                    {reqs.map((r) => (
                      <label key={r.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg p-1.5">
                        <input type="checkbox" name="requirementIds" value={r.id} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                        <span>
                          <span className="font-medium">
                            {r.code} — {r.title}
                          </span>
                          <span className="block text-xs text-slate-400">{r.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button className={btnPrimary}>Assign selected requirements</button>
          </form>
        </Card>
      )}

      <Card title={isAdmin ? "All assignments" : "My department's assignments"}>
        {assignments.length === 0 ? (
          <EmptyState message="No compliance assignments yet" />
        ) : (
          <Table
            head={
              <>
                <Th>Requirement</Th>
                <Th>Department</Th>
                <Th>Owner</Th>
                <Th>Due</Th>
                <Th>Proof</Th>
                <Th>Status</Th>
                <Th />
              </>
            }
          >
            {assignments.map((a) => {
              const isOverdue = a.status !== "COMPLIANT" && a.dueDate && a.dueDate < now;
              const canAct = isAdmin || a.ownerId === user.id || (user.role === "MANAGER" && user.departmentId === a.departmentId);
              return (
                <tr key={a.id} className={isOverdue ? "bg-rose-50/60 dark:bg-rose-950/20" : ""}>
                  <Td>
                    <div className="font-medium text-sm">
                      <Chip label={a.requirement.standard.replaceAll("_", " ")} tone="violet" />{" "}
                      {a.requirement.code} — {a.requirement.title}
                    </div>
                    <div className="text-xs text-slate-400 max-w-[300px]">{a.requirement.description}</div>
                  </Td>
                  <Td>{a.department.code}</Td>
                  <Td>{a.owner.name}</Td>
                  <Td className={isOverdue ? "text-rose-600 font-semibold" : ""}>
                    {a.dueDate ? a.dueDate.toLocaleDateString() : "—"}
                    {isOverdue && <div className="text-[10px] uppercase">Overdue</div>}
                  </Td>
                  <Td>
                    {a.proofUrl ? (
                      <a href={a.proofUrl} target="_blank" className="text-sky-600 text-xs hover:underline">
                        View proof
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>
                    <Chip label={a.status} tone={a.status === "COMPLIANT" ? "green" : a.status === "IN_PROGRESS" ? "blue" : "amber"} />
                    {a.closedAt && (
                      <div className="text-[10px] text-slate-400 mt-0.5">closed {a.closedAt.toLocaleDateString()}</div>
                    )}
                  </Td>
                  <Td>
                    {canAct && a.status !== "COMPLIANT" && (
                      <form action={updateAssignment} className="flex flex-col gap-1.5 min-w-40">
                        <input type="hidden" name="id" value={a.id} />
                        {!a.proofUrl && <FileUploadField name="proofUrl" label="Upload proof" />}
                        <div className="flex gap-1.5">
                          <select name="status" defaultValue={a.status === "PENDING" ? "IN_PROGRESS" : "COMPLIANT"} className={`${inputCls} !w-auto !py-1 text-xs`}>
                            <option value="IN_PROGRESS">In progress</option>
                            <option value="COMPLIANT">Compliant (needs proof)</option>
                          </select>
                          <button className="text-xs text-emerald-600 hover:underline cursor-pointer">Update</button>
                        </div>
                      </form>
                    )}
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
