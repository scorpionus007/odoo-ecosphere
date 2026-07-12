import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Chip, ProgressBar, Field, inputCls, btnPrimary, btnSecondary } from "@/components/ui";
import { createPolicy, acknowledgePolicy, remindPolicy } from "../actions";
import { ScrollText, BellRing } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const user = await requireUser();
  const canManage = user.role === "ADMIN" || user.role === "MANAGER";
  const [policies, headcount] = await Promise.all([
    db.esgPolicy.findMany({
      include: { acknowledgements: { include: { employee: true } } },
      orderBy: { effectiveDate: "desc" },
    }),
    db.user.count({ where: { status: "ACTIVE" } }),
  ]);

  return (
    <>
      <PageHeader title="ESG Policies" subtitle="Governance policies with employee acknowledgements" />
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
                  <input name="category" defaultValue="General" className={inputCls} />
                </Field>
              </div>
              <Field label="Policy content">
                <textarea name="content" rows={4} required className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="requiresAck" defaultChecked className="h-4 w-4 accent-emerald-600" />
                Requires acknowledgement
              </label>
              <button className={btnPrimary}>Publish</button>
            </form>
          </Card>
        )}
        <div className={`space-y-4 ${canManage ? "lg:col-span-2" : "lg:col-span-3"}`}>
          {policies.map((p) => {
            const acked = p.acknowledgements.some((a) => a.employeeId === user.id);
            const rate = headcount ? Math.round((p.acknowledgements.length / headcount) * 100) : 0;
            return (
              <Card key={p.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      <ScrollText size={15} className="text-emerald-600" />
                      {p.title}
                      <span className="text-xs text-slate-400">v{p.version}</span>
                      <Chip label={p.category} tone="violet" />
                      <Chip label={p.status} />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-2xl whitespace-pre-line">
                      {p.content}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {p.requiresAck &&
                      (acked ? (
                        <Chip label="Acknowledged ✓" tone="green" />
                      ) : (
                        <form action={acknowledgePolicy}>
                          <input type="hidden" name="policyId" value={p.id} />
                          <button className={btnPrimary}>Acknowledge</button>
                        </form>
                      ))}
                    {canManage && p.requiresAck && (
                      <form action={remindPolicy}>
                        <input type="hidden" name="policyId" value={p.id} />
                        <button className={btnSecondary}>
                          <BellRing size={13} /> Send reminders
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                {p.requiresAck && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>
                        Acknowledgements: {p.acknowledgements.length}/{headcount}
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
