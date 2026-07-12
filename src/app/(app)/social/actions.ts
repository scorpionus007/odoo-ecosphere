"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { awardPoints } from "@/lib/gamify";
import { assertCanManageEmployee } from "@/lib/scope";

// ---------- CSR Activities ----------

export async function createActivity(formData: FormData) {
  const user = await requireRole("ADMIN", "MANAGER");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const date = new Date(String(formData.get("date")));
  const location = String(formData.get("location") ?? "") || null;
  const pointsReward = Number(formData.get("pointsReward") ?? 50);
  if (!title || !categoryId || isNaN(date.getTime())) return;
  await db.csrActivity.create({
    data: { title, description, categoryId, date, location, pointsReward, createdById: user.id },
  });
  revalidatePath("/social");
}

export async function setActivityStatus(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"].includes(status)) return;
  await db.csrActivity.update({ where: { id }, data: { status } });
  revalidatePath("/social");
}

// ---------- Participation ----------

export async function joinActivity(formData: FormData) {
  const user = await requireUser();
  const activityId = String(formData.get("activityId"));
  const exists = await db.employeeParticipation.findUnique({
    where: { employeeId_activityId: { employeeId: user.id, activityId } },
  });
  if (exists) return;
  await db.employeeParticipation.create({ data: { employeeId: user.id, activityId } });
  revalidatePath("/social");
}

export async function attachProof(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const proofUrl = String(formData.get("proofUrl") ?? "");
  const p = await db.employeeParticipation.findUnique({ where: { id } });
  if (!p || p.employeeId !== user.id) return;
  await db.employeeParticipation.update({ where: { id }, data: { proofUrl } });
  revalidatePath("/social");
}

export async function decideParticipation(formData: FormData) {
  const actor = await requireRole("ADMIN", "MANAGER");
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision")); // APPROVED | REJECTED
  const p = await db.employeeParticipation.findUnique({
    where: { id },
    include: { activity: true, employee: true },
  });
  if (!p || p.approvalStatus !== "PENDING") return;
  await assertCanManageEmployee(actor, p.employeeId); // managers decide only for their department

  // Evidence Requirement toggle: cannot approve without proof
  const settings = await getSettings();
  if (decision === "APPROVED" && settings.evidenceRequirement && !p.proofUrl) {
    throw new Error("Evidence required: participation cannot be approved without an attached proof file");
  }

  if (decision === "APPROVED") {
    await db.employeeParticipation.update({
      where: { id },
      data: {
        approvalStatus: "APPROVED",
        pointsEarned: p.activity.pointsReward,
        completionDate: new Date(),
      },
    });
    await awardPoints(p.employeeId, p.activity.pointsReward);
    await notify(
      p.employeeId,
      "APPROVAL",
      `CSR participation approved: ${p.activity.title}`,
      `You earned ${p.activity.pointsReward} points!`,
      "/social"
    );
  } else {
    await db.employeeParticipation.update({ where: { id }, data: { approvalStatus: "REJECTED" } });
    await notify(
      p.employeeId,
      "APPROVAL",
      `CSR participation rejected: ${p.activity.title}`,
      "Contact your manager for details.",
      "/social"
    );
  }
  revalidatePath("/social");
  revalidatePath("/approvals");
}

// ---------- Training ----------

export async function addTraining(formData: FormData) {
  const actor = await requireRole("ADMIN", "MANAGER");
  const employeeId = String(formData.get("employeeId"));
  const courseTitle = String(formData.get("courseTitle") ?? "").trim();
  if (!employeeId || !courseTitle) return;
  await assertCanManageEmployee(actor, employeeId); // managers assign within their department
  await db.trainingRecord.create({ data: { employeeId, courseTitle } });
  revalidatePath("/social/training");
}

export async function completeTraining(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const t = await db.trainingRecord.findUnique({ where: { id } });
  if (!t) return;
  if (t.employeeId !== user.id && user.role === "EMPLOYEE") return;
  await db.trainingRecord.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  revalidatePath("/social/training");
}
