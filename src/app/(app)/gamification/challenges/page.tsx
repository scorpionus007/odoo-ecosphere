import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Chip, ProgressBar, Field, inputCls, btnPrimary, btnSecondary, EmptyState } from "@/components/ui";
import {
  createChallenge, setChallengeStatus, joinChallenge, updateChallengeProgress, attachChallengeProof,
} from "../actions";
import ProofUpload from "@/components/ProofUpload";
import { Trophy, CalendarDays, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

const NEXT_STATUS: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["UNDER_REVIEW", "ARCHIVED"],
  UNDER_REVIEW: ["COMPLETED", "ACTIVE", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export default async function ChallengesPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const canManage = isAdmin || user.role === "MANAGER";
  const [challenges, categories, departments] = await Promise.all([
    db.challenge.findMany({
      // admin: everything; others: org-wide + their department's quests
      where: isAdmin ? {} : { OR: [{ departmentId: null }, { departmentId: user.departmentId }] },
      include: { category: true, department: true, participations: { include: { employee: true } } },
      orderBy: [{ status: "asc" }, { deadline: "asc" }],
    }),
    db.category.findMany({ where: { type: "CHALLENGE", status: "ACTIVE" } }),
    db.department.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  const visible = canManage ? challenges : challenges.filter((c) => c.status !== "DRAFT");
  // managers run the lifecycle only for quests they own (their department's)
  const canMove = (c: (typeof challenges)[number]) => isAdmin || c.departmentId === user.departmentId;

  return (
    <>
      <PageHeader
        title="Quest Studio"
        subtitle={`Lifecycle: Draft → Active → Under Review → Completed (or Archived at any point)${
          isAdmin ? " — you assign org-wide or per-department quests" : " — your quests are assigned to your team"
        }`}
      />
      <div className="grid lg:grid-cols-3 gap-4">
        {canManage && (
          <Card title="Create quest (starts as Draft)">
            <form action={createChallenge} className="space-y-3">
              <Field label="Title">
                <input name="title" required className={inputCls} />
              </Field>
              <Field label="Description">
                <textarea name="description" rows={2} required className={inputCls} />
              </Field>
              {isAdmin ? (
                <Field label="Assign to">
                  <select name="departmentId" className={inputCls} defaultValue="">
                    <option value="">Organization-wide (everyone)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} only
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="text-xs text-slate-400 -mt-1">Assigned to your team automatically.</p>
              )}
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
                <Field label="Difficulty">
                  <select name="difficulty" className={inputCls} defaultValue="MEDIUM">
                    {["EASY", "MEDIUM", "HARD"].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="XP reward">
                  <input name="xp" type="number" min="10" defaultValue={100} className={inputCls} />
                </Field>
                <Field label="Deadline">
                  <input name="deadline" type="date" required className={inputCls} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="evidenceRequired" defaultChecked className="h-4 w-4 accent-emerald-600" />
                Evidence required
              </label>
              <button className={btnPrimary}>Create draft</button>
            </form>
          </Card>
        )}

        <div className={`space-y-4 ${canManage ? "lg:col-span-2" : "lg:col-span-3"}`}>
          {visible.length === 0 && <EmptyState message="No challenges yet" />}
          {visible.map((c) => {
            const mine = c.participations.find((p) => p.employeeId === user.id);
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2 flex-wrap">
                      <Trophy size={15} className="text-amber-500" />
                      {c.title}
                      <Chip label={c.status} />
                      <Chip label={c.difficulty} />
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-300">
                        <Zap size={12} /> {c.xp} XP
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-3 mt-1 flex-wrap">
                      <Chip label={c.category.name} tone="blue" />
                      <Chip label={c.department ? `${c.department.name} team` : "Org-wide"} tone={c.department ? "violet" : "green"} />
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={12} /> due {c.deadline.toLocaleDateString()}
                      </span>
                      {c.evidenceRequired && <Chip label="Evidence required" tone="amber" />}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-xl">{c.description}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {c.status === "ACTIVE" && !mine && !isAdmin && (
                      <form action={joinChallenge}>
                        <input type="hidden" name="challengeId" value={c.id} />
                        <button className={btnPrimary}>Join challenge</button>
                      </form>
                    )}
                    {canManage && canMove(c) && NEXT_STATUS[c.status].length > 0 && (
                      <form action={setChallengeStatus} className="flex gap-1.5">
                        <input type="hidden" name="id" value={c.id} />
                        <select name="status" className={`${inputCls} !w-auto !py-1 text-xs`}>
                          {NEXT_STATUS[c.status].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        <button className={btnSecondary}>Move</button>
                      </form>
                    )}
                  </div>
                </div>

                {mine && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="text-xs font-medium text-slate-500">
                        My progress — <Chip label={mine.approvalStatus} tone={
                          mine.approvalStatus === "APPROVED" ? "green" : mine.approvalStatus === "REJECTED" ? "red" : "amber"
                        } />
                        {mine.xpAwarded > 0 && (
                          <span className="ml-2 text-violet-600 dark:text-violet-300 font-semibold">
                            +{mine.xpAwarded} XP earned
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {mine.approvalStatus === "PENDING" && !mine.proofUrl && (
                          <ProofUpload participationId={mine.id} action={attachChallengeProof} />
                        )}
                        {mine.proofUrl && (
                          <a href={mine.proofUrl} target="_blank" className="text-xs text-sky-600 hover:underline">
                            View proof
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <ProgressBar value={mine.progress} tone="violet" />
                      </div>
                      <span className="text-xs text-slate-500 w-10">{mine.progress}%</span>
                      {mine.approvalStatus === "PENDING" && (
                        <form action={updateChallengeProgress} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={mine.id} />
                          <input
                            name="progress"
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={mine.progress}
                            className={`${inputCls} !w-20 !py-1 text-xs`}
                          />
                          <button className={btnSecondary}>Update</button>
                        </form>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                  {c.participations.length} participant{c.participations.length === 1 ? "" : "s"}
                  {c.participations.length > 0 &&
                    ": " + c.participations.map((p) => `${p.employee.name} (${p.progress}%)`).join(", ")}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
