import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getScope } from "@/lib/scope";
import { PageHeader, Card, Chip, ProgressBar, Field, inputCls, btnPrimary, btnSecondary } from "@/components/ui";
import { createPolicy, acknowledgePolicy, remindPolicy, setPolicyStatus } from "../actions";
import FileUploadField from "@/components/FileUploadField";
import { ScrollText, BellRing, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const user = await requireUser();
  const scope = await getScope();
  const canManage = user.role === "ADMIN" || user.role === "MANAGER";
  const [policies, departments] = await Promise.all([
    db.esgPolicy.findMany({
      // non-admins see org-wide policies + their own department's
      where: scope.isAdmin
        ? {}
        : { OR: [{ departmentId: null }, { departmentId: scope.departmentId }] },
      include: {
        department: true,
        acknowledgements: { include: { employee: true } },
      },
      orderBy: [{ status: "asc" }, { effectiveDate: "desc" }],
    }),
    db.department.findMany({
      where: { status: "ACTIVE", ...(scope.departmentId && !scope.isAdmin ? { id: scope.departmentId } : {}) },
    }),
  ]);

  // employees don't see drafts
  const visible = canManage ? policies : policies.filter((p) => p.status !== "DRAFT");
  const myPending = visible.filter((p) =>
    p.acknowledgements.some((a) => a.employeeId === user.id && a.status === "PENDING")
  ).length;

  return (
    <>
      <PageHeader
        title="ESG Policies"
        subtitle={`Lifecycle: Draft → Active (auto-creates pending acknowledgements) → Archived${
          myPending > 0 ? ` · you have ${myPending} pending acknowledgement${myPending === 1 ? "" : "s"}` : ""
        }`}
      />
      <div className="grid lg:grid-cols-3 gap-4">
        {canManage && (
          <Card title="Publish policy">
            <form action={createPolicy} className="space-y-3">
              <Field label="Title">
                <input name="title" required className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Version">
                  <input name="version" defaultValue="1.0" className={inputCls} />
                </Field>
                <Field label="Category">
                  <select name="category" className={inputCls} defaultValue="Governance">
                    <option>Environmental</option>
                    <option>Social</option>
                    <option>Governance</option>
                    <option>General</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Applies to">
                  <select name="departmentId" className={inputCls} defaultValue="">
                    <option value="">All departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Initial status">
                  <select name="status" className={inputCls} defaultValue="DRAFT">
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active (send for acknowledgement)</option>
                  </select>
                </Field>
              </div>
              <Field label="Policy content">
                <textarea name="content" rows={4} required className={inputCls} />
              </Field>
              <Field label="Policy document (optional)">
                <FileUploadField name="documentUrl" label="Upload document" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requiresAck" defaultChecked className="h-4 w-4 accent-emerald-600" />
                Requires acknowledgement
              </label>
              <button className={btnPrimary}>Create policy</button>
            </form>
          </Card>
        )}
        <div className={`space-y-4 ${canManage ? "lg:col-span-2" : "lg:col-span-3"}`}>
          {visible.map((p) => {
            const mine = p.acknowledgements.find((a) => a.employeeId === user.id);
            const acked = mine?.status === "ACKNOWLEDGED";
            const total = p.acknowledgements.length;
            const done = p.acknowledgements.filter((a) => a.status === "ACKNOWLEDGED").length;
            const rate = total ? Math.round((done / total) * 100) : 0;
            return (
              <Card key={p.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2 flex-wrap">
                      <ScrollText size={15} className="text-emerald-600" />
                      {p.title}
                      <span className="text-xs text-slate-400">v{p.version}</span>
                      <Chip label={p.category} tone="violet" />
                      <Chip label={p.department ? p.department.name : "All departments"} tone="blue" />
                      <Chip label={p.status} />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-2xl whitespace-pre-line">
                      {p.content}
                    </p>
                    {p.documentUrl && (
                      <a
                        href={p.documentUrl}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:underline mt-2"
                      >
                        <FileText size={13} /> View policy document
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {p.status === "ACTIVE" &&
                      p.requiresAck &&
                      (acked ? (
                        <Chip label="Acknowledged ✓" tone="green" />
                      ) : (
                        <form action={acknowledgePolicy}>
                          <input type="hidden" name="policyId" value={p.id} />
                          <button className={btnPrimary}>Acknowledge</button>
                        </form>
                      ))}
                    {canManage && (
                      <form action={setPolicyStatus} className="flex gap-1.5">
                        <input type="hidden" name="id" value={p.id} />
                        <select name="status" defaultValue={p.status} className={`${inputCls} !w-auto !py-1 text-xs`}>
                          <option value="DRAFT">Draft</option>
                          <option value="ACTIVE">Active</option>
                          <option value="ARCHIVED">Archived</option>
                        </select>
                        <button className={btnSecondary}>Set</button>
                      </form>
                    )}
                    {canManage && p.requiresAck && p.status === "ACTIVE" && (
                      <form action={remindPolicy}>
                        <input type="hidden" name="policyId" value={p.id} />
                        <button className={btnSecondary}>
                          <BellRing size={13} /> Remind pending
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                {p.requiresAck && p.status !== "DRAFT" && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>
                        Acknowledged: {done}/{total}
                        {total > 0 && done < total && (
                          <span className="text-slate-400">
                            {" "}
                            · pending:{" "}
                            {p.acknowledgements
                              .filter((a) => a.status === "PENDING")
                              .slice(0, 4)
                              .map((a) => a.employee.name.split(" ")[0])
                              .join(", ")}
                            {total - done > 4 ? "…" : ""}
                          </span>
                        )}
                      </span>
                      <span>{rate}%</span>
                    </div>
                    <ProgressBar value={rate} tone={rate >= 80 ? "emerald" : rate >= 40 ? "amber" : "rose"} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
