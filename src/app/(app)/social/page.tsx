import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader, Card, Chip, Field, inputCls, btnPrimary, btnSecondary, EmptyState } from "@/components/ui";
import { createActivity, joinActivity, attachProof, setActivityStatus } from "./actions";
import ProofUpload from "@/components/ProofUpload";
import { MapPin, CalendarDays, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  const user = await requireUser();
  const canManage = user.role === "ADMIN" || user.role === "MANAGER";
  const [activities, categories, settings] = await Promise.all([
    db.csrActivity.findMany({
      include: {
        category: true,
        createdBy: true,
        participations: { include: { employee: true } },
      },
      orderBy: { date: "desc" },
    }),
    db.category.findMany({ where: { type: "CSR", status: "ACTIVE" } }),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="CSR Activities"
        subtitle={`Social initiatives with employee participation${
          settings.evidenceRequirement ? " — proof required before approval" : ""
        }`}
      />
      <div className="grid lg:grid-cols-3 gap-4">
        {canManage && (
          <Card title="Organize CSR activity">
            <form action={createActivity} className="space-y-3">
              <Field label="Title">
                <input name="title" required className={inputCls} />
              </Field>
              <Field label="Description">
                <textarea name="description" rows={2} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select name="categoryId" required className={inputCls}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Date">
                  <input name="date" type="date" required className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Location">
                  <input name="location" className={inputCls} />
                </Field>
                <Field label="Points reward">
                  <input name="pointsReward" type="number" min="0" defaultValue={50} className={inputCls} />
                </Field>
              </div>
              <Field label="Volunteer hours credited per participant">
                <input name="volunteerHours" type="number" min="0" step="0.5" defaultValue={2} className={inputCls} />
              </Field>
              <button className={btnPrimary}>Create activity</button>
            </form>
          </Card>
        )}

        <div className={`space-y-4 ${canManage ? "lg:col-span-2" : "lg:col-span-3"}`}>
          {activities.length === 0 && <EmptyState message="No CSR activities yet" />}
          {activities.map((a) => {
            const mine = a.participations.find((p) => p.employeeId === user.id);
            return (
              <Card key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {a.title} <Chip label={a.status} />
                    </div>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={12} /> {a.date.toLocaleDateString()}
                      </span>
                      {a.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} /> {a.location}
                        </span>
                      )}
                      <Chip label={a.category.name} tone="blue" />
                      <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-300 font-medium">
                        <Sparkles size={12} /> {a.pointsReward} pts
                      </span>
                      <span className="text-slate-400">~{a.volunteerHours}h volunteering</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-xl">{a.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {!mine && a.status !== "CANCELLED" && a.status !== "COMPLETED" && (
                      <form action={joinActivity}>
                        <input type="hidden" name="activityId" value={a.id} />
                        <button className={btnPrimary}>Participate</button>
                      </form>
                    )}
                    {mine && (
                      <div className="text-right space-y-1.5">
                        <Chip
                          label={`My status: ${mine.approvalStatus}`}
                          tone={
                            mine.approvalStatus === "APPROVED"
                              ? "green"
                              : mine.approvalStatus === "REJECTED"
                              ? "red"
                              : "amber"
                          }
                        />
                        {mine.approvalStatus === "PENDING" && !mine.proofUrl && (
                          <div>
                            <ProofUpload participationId={mine.id} action={attachProof} />
                          </div>
                        )}
                        {mine.proofUrl && (
                          <a
                            href={mine.proofUrl}
                            target="_blank"
                            className="block text-xs text-sky-600 hover:underline"
                          >
                            View proof
                          </a>
                        )}
                      </div>
                    )}
                    {canManage && (
                      <form action={setActivityStatus} className="flex gap-1.5">
                        <input type="hidden" name="id" value={a.id} />
                        <select name="status" defaultValue={a.status} className={`${inputCls} !w-auto !py-1 text-xs`}>
                          {["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <button className={btnSecondary}>Set</button>
                      </form>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                  {a.participations.length} participant{a.participations.length === 1 ? "" : "s"}:{" "}
                  {a.participations.map((p) => p.employee.name).join(", ") || "—"}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
