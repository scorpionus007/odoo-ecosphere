import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Table, Th, Td, Chip, Field, inputCls, btnPrimary, btnSecondary, StatCard } from "@/components/ui";
import { createIssue, setIssueStatus, flagOverdueIssues } from "../actions";
import { ShieldAlert, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  const user = await requireUser();
  const canManage = user.role === "ADMIN" || user.role === "MANAGER";
  const now = new Date();
  const [issues, users, audits] = await Promise.all([
    db.complianceIssue.findMany({
      include: { owner: true, audit: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
    db.user.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    db.audit.findMany({ orderBy: { date: "desc" } }),
  ]);

  const open = issues.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS");
  const overdue = open.filter((i) => i.dueDate < now);

  return (
    <>
      <PageHeader
        title="Compliance Issues"
        subtitle="Every issue has a mandatory owner and due date — overdue open issues are flagged"
        actions={
          canManage ? (
            <form action={flagOverdueIssues}>
              <button className={btnSecondary}>
                <Clock size={14} /> Notify overdue owners
              </button>
            </form>
          ) : undefined
        }
      />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <StatCard label="Open issues" value={open.length} icon={<ShieldAlert size={18} />} tone="amber" />
        <StatCard label="Overdue" value={overdue.length} icon={<Clock size={18} />} tone="rose" />
        <StatCard label="Resolved/closed" value={issues.length - open.length} tone="emerald" icon={<ShieldAlert size={18} />} />
        <StatCard label="Total" value={issues.length} tone="slate" icon={<ShieldAlert size={18} />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {canManage && (
          <Card title="Raise compliance issue">
            <form action={createIssue} className="space-y-3">
              <Field label="Title">
                <input name="title" required className={inputCls} />
              </Field>
              <Field label="Description">
                <textarea name="description" rows={2} required className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Severity">
                  <select name="severity" className={inputCls} defaultValue="MEDIUM">
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Linked audit">
                  <select name="auditId" className={inputCls} defaultValue="">
                    <option value="">— none —</option>
                    {audits.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Owner (mandatory)">
                  <select name="ownerId" required className={inputCls}>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Due date (mandatory)">
                  <input name="dueDate" type="date" required className={inputCls} />
                </Field>
              </div>
              <button className={btnPrimary}>Raise issue</button>
            </form>
          </Card>
        )}
        <div className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
          <Table
            head={
              <>
                <Th>Issue</Th>
                <Th>Severity</Th>
                <Th>Owner</Th>
                <Th>Due</Th>
                <Th>Status</Th>
                <Th />
              </>
            }
          >
            {issues.map((i) => {
              const isOverdue = (i.status === "OPEN" || i.status === "IN_PROGRESS") && i.dueDate < now;
              return (
                <tr key={i.id} className={isOverdue ? "bg-rose-50/60 dark:bg-rose-950/20" : ""}>
                  <Td>
                    <div className="font-medium">{i.title}</div>
                    <div className="text-xs text-slate-400 max-w-[280px] truncate">
                      {i.audit ? `${i.audit.title} · ` : ""}
                      {i.description}
                    </div>
                  </Td>
                  <Td>
                    <Chip label={i.severity} />
                  </Td>
                  <Td>{i.owner.name}</Td>
                  <Td className={isOverdue ? "text-rose-600 font-semibold" : ""}>
                    {i.dueDate.toLocaleDateString()}
                    {isOverdue && <div className="text-[10px] uppercase">Overdue</div>}
                  </Td>
                  <Td>
                    <Chip label={i.status} />
                  </Td>
                  <Td>
                    {(canManage || i.ownerId === user.id) && (
                      <form action={setIssueStatus} className="flex gap-1.5">
                        <input type="hidden" name="id" value={i.id} />
                        <select name="status" defaultValue={i.status} className={`${inputCls} !w-auto !py-1 text-xs`}>
                          {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <button className="text-xs text-emerald-600 hover:underline cursor-pointer">Set</button>
                      </form>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </div>
      </div>
    </>
  );
}
