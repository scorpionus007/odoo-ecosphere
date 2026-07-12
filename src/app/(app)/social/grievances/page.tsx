import { db } from "@/lib/db";
import { getScope } from "@/lib/scope";
import { PageHeader, Card, Chip, Field, inputCls, btnPrimary, StatCard, EmptyState } from "@/components/ui";
import { fileGrievance, updateGrievance } from "../actions";
import { MessageSquareWarning, ShieldQuestion, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORY_TONE: Record<string, string> = {
  HARASSMENT: "red",
  SAFETY: "amber",
  ETHICS: "violet",
  DISCRIMINATION: "red",
  OTHER: "gray",
};

export default async function GrievancesPage() {
  const scope = await getScope();
  const { user, isAdmin } = scope;
  const canTriage = isAdmin || user.role === "MANAGER";

  const grievances = await db.grievance.findMany({
    where: isAdmin
      ? {}
      : user.role === "MANAGER"
      ? // managers: their department's grievances + their own filings
        { OR: [{ departmentId: user.departmentId }, { reporterId: user.id }] }
      : // employees: only their own non-anonymous filings
        { reporterId: user.id },
    include: { reporter: true, department: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const departments = await db.department.findMany({ where: { status: "ACTIVE" } });

  const open = grievances.filter((g) => g.status === "OPEN" || g.status === "UNDER_REVIEW").length;
  const resolved = grievances.filter((g) => g.status === "RESOLVED").length;

  return (
    <>
      <PageHeader
        title="Grievance & Ethics Channel"
        subtitle="Confidential reporting for harassment, safety, ethics and discrimination concerns (BRSR P3 grievance mechanism) — file anonymously if you prefer"
      />

      <div className="grid grid-cols-3 gap-3 mb-6 max-w-xl">
        <StatCard label="Open" value={open} icon={<MessageSquareWarning size={18} />} tone="amber" />
        <StatCard label="Resolved" value={resolved} icon={<CheckCircle2 size={18} />} tone="emerald" />
        <StatCard label="Total (in scope)" value={grievances.length} icon={<ShieldQuestion size={18} />} tone="slate" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Raise a concern">
          <form action={fileGrievance} className="space-y-3">
            <Field label="Category">
              <select name="category" className={inputCls} defaultValue="OTHER">
                <option value="HARASSMENT">Harassment</option>
                <option value="SAFETY">Safety hazard</option>
                <option value="ETHICS">Ethics / integrity</option>
                <option value="DISCRIMINATION">Discrimination</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Related department (optional)">
              <select name="departmentId" className={inputCls} defaultValue="">
                <option value="">— not department-specific —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Describe the concern">
              <textarea name="description" rows={4} required className={inputCls} />
            </Field>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="anonymous" className="mt-0.5 h-4 w-4 accent-emerald-600" />
              <span>
                File anonymously
                <span className="block text-xs text-slate-400">
                  Your identity is never stored with the report — but you won&apos;t receive status updates.
                </span>
              </span>
            </label>
            <button className={btnPrimary}>Submit confidentially</button>
          </form>
        </Card>

        <div className={`space-y-4 lg:col-span-2`}>
          {grievances.length === 0 && <EmptyState message="No grievances in your scope — that's a good thing." />}
          {grievances.map((g) => (
            <Card key={g.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip label={g.category} tone={CATEGORY_TONE[g.category] ?? "gray"} />
                    <Chip label={g.status} tone={g.status === "RESOLVED" ? "green" : g.status === "DISMISSED" ? "gray" : "amber"} />
                    {g.department && <Chip label={g.department.name} tone="blue" />}
                    <span className="text-xs text-slate-400">
                      {g.createdAt.toLocaleDateString()} · {g.anonymous ? "Anonymous" : g.reporter?.name ?? "—"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-2xl">{g.description}</p>
                  {g.resolution && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-2">
                      <b>Resolution:</b> {g.resolution}
                    </p>
                  )}
                </div>
                {canTriage && g.status !== "RESOLVED" && g.status !== "DISMISSED" && (
                  <form action={updateGrievance} className="flex flex-col items-end gap-1.5 min-w-52">
                    <input type="hidden" name="id" value={g.id} />
                    <select name="status" defaultValue="UNDER_REVIEW" className={`${inputCls} !w-auto !py-1 text-xs`}>
                      <option value="UNDER_REVIEW">Under review</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="DISMISSED">Dismissed</option>
                    </select>
                    <input name="resolution" placeholder="Resolution note" className={`${inputCls} text-xs`} />
                    <button className="text-xs text-emerald-600 hover:underline cursor-pointer">Update</button>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
