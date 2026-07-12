import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Table, Th, Td, Chip, Field, inputCls, btnPrimary, btnSecondary } from "@/components/ui";
import { createAudit, setAuditStatus } from "../actions";

export const dynamic = "force-dynamic";

export default async function AuditsPage() {
  const user = await requireUser();
  const canManage = user.role === "ADMIN" || user.role === "MANAGER";
  const [audits, departments, managers] = await Promise.all([
    db.audit.findMany({
      include: { department: true, auditor: true, issues: true },
      orderBy: { date: "desc" },
    }),
    db.department.findMany({ where: { status: "ACTIVE" } }),
    db.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER"] } } }),
  ]);

  return (
    <>
      <PageHeader title="Audits" subtitle="Governance audit cycles and findings" />
      <div className="grid lg:grid-cols-3 gap-4">
        {canManage && (
          <Card title="Schedule audit">
            <form action={createAudit} className="space-y-3">
              <Field label="Title">
                <input name="title" required className={inputCls} />
              </Field>
              <Field label="Scope">
                <input name="scope" placeholder="e.g. Fleet & logistics" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Department">
                  <select name="departmentId" className={inputCls} defaultValue="">
                    <option value="">Organization-wide</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Auditor">
                  <select name="auditorId" className={inputCls} defaultValue="">
                    <option value="">— unassigned —</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Date">
                <input name="date" type="date" required className={inputCls} />
              </Field>
              <button className={btnPrimary}>Schedule</button>
            </form>
          </Card>
        )}
        <div className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className="space-y-4">
            {audits.map((a) => (
              <Card key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {a.title} <Chip label={a.status} />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {a.date.toLocaleDateString()} · {a.department?.name ?? "Organization-wide"} · Auditor:{" "}
                      {a.auditor?.name ?? "unassigned"} · {a.issues.length} issue{a.issues.length === 1 ? "" : "s"}
                    </div>
                    {a.scope && <div className="text-sm text-slate-500 mt-1">Scope: {a.scope}</div>}
                    {a.findings && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-2xl">
                        <b>Findings:</b> {a.findings}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <form action={setAuditStatus} className="flex flex-col items-end gap-2 min-w-56">
                      <input type="hidden" name="id" value={a.id} />
                      <select name="status" defaultValue={a.status} className={`${inputCls} !w-auto !py-1 text-xs`}>
                        {["PLANNED", "IN_PROGRESS", "COMPLETED"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <input name="findings" placeholder="Add/replace findings" className={`${inputCls} text-xs`} />
                      <button className={btnSecondary}>Update</button>
                    </form>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
