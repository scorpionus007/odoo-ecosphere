import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Chip, ProgressBar, Field, inputCls, btnPrimary, btnSecondary } from "@/components/ui";
import { createGoal, updateGoalProgress } from "../actions";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const user = await requireUser();
  const canEdit = user.role === "ADMIN" || user.role === "MANAGER";
  const [goals, departments] = await Promise.all([
    db.environmentalGoal.findMany({ include: { department: true }, orderBy: { deadline: "asc" } }),
    db.department.findMany({ where: { status: "ACTIVE" } }),
  ]);

  return (
    <>
      <PageHeader title="Sustainability Goals" subtitle="Targets with live progress tracking" />
      <div className="grid lg:grid-cols-3 gap-4">
        {canEdit && (
          <Card title="New goal">
            <form action={createGoal} className="space-y-3">
              <Field label="Title">
                <input name="title" required placeholder="e.g. Cut fleet emissions 20%" className={inputCls} />
              </Field>
              <Field label="Metric">
                <input name="metric" required placeholder="What is measured" className={inputCls} />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Baseline">
                  <input name="baseline" type="number" step="0.01" required className={inputCls} />
                </Field>
                <Field label="Target">
                  <input name="target" type="number" step="0.01" required className={inputCls} />
                </Field>
                <Field label="Unit">
                  <input name="unit" defaultValue="kgCO2e" className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Deadline">
                  <input name="deadline" type="date" required className={inputCls} />
                </Field>
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
              </div>
              <button className={btnPrimary}>Create goal</button>
            </form>
          </Card>
        )}
        <div className={`space-y-4 ${canEdit ? "lg:col-span-2" : "lg:col-span-3"}`}>
          {goals.map((g) => {
            const span = Math.abs(g.baseline - g.target) || 1;
            const progress = Math.min(100, Math.round((Math.abs(g.baseline - g.currentValue) / span) * 100));
            return (
              <Card key={g.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <div className="font-semibold">{g.title}</div>
                    <div className="text-xs text-slate-400">
                      {g.metric} · {g.department?.name ?? "Organization-wide"} · due{" "}
                      {g.deadline.toLocaleDateString()}
                    </div>
                  </div>
                  <Chip label={g.status} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <ProgressBar value={progress} tone={g.status === "MISSED" ? "rose" : "emerald"} />
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">
                    {g.baseline} → <b>{g.currentValue}</b> → {g.target} {g.unit} ({progress}%)
                  </div>
                </div>
                {canEdit && (
                  <form action={updateGoalProgress} className="flex items-end gap-2 mt-3">
                    <input type="hidden" name="id" value={g.id} />
                    <Field label="Update current value">
                      <input
                        name="currentValue"
                        type="number"
                        step="0.01"
                        defaultValue={g.currentValue}
                        className={inputCls}
                      />
                    </Field>
                    <button className={btnSecondary}>Update</button>
                  </form>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
