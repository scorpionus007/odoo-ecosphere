"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { awardPoints, runBadgeEngine } from "@/lib/gamify";

// ---------- Challenges (lifecycle: DRAFT → ACTIVE → UNDER_REVIEW → COMPLETED / ARCHIVED) ----------

const LIFECYCLE = ["DRAFT", "ACTIVE", "UNDER_REVIEW", "COMPLETED", "ARCHIVED"];

export async function createChallenge(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const xp = Number(formData.get("xp") ?? 100);
  const difficulty = String(formData.get("difficulty") ?? "MEDIUM");
  const evidenceRequired = formData.get("evidenceRequired") === "on";
  const deadline = new Date(String(formData.get("deadline")));
  if (!title || !categoryId || isNaN(deadline.getTime())) return;
  await db.challenge.create({
    data: { title, description, categoryId, xp, difficulty, evidenceRequired, deadline },
  });
  revalidatePath("/gamification/challenges");
}

export async function setChallengeStatus(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!LIFECYCLE.includes(status)) return;
  await db.challenge.update({ where: { id }, data: { status } });
  revalidatePath("/gamification/challenges");
}

// ---------- Challenge participation ----------

export async function joinChallenge(formData: FormData) {
  const user = await requireUser();
  const challengeId = String(formData.get("challengeId"));
  const ch = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!ch || ch.status !== "ACTIVE") return;
  const exists = await db.challengeParticipation.findUnique({
    where: { challengeId_employeeId: { challengeId, employeeId: user.id } },
  });
  if (exists) return;
  await db.challengeParticipation.create({ data: { challengeId, employeeId: user.id } });
  revalidatePath("/gamification/challenges");
}

export async function updateChallengeProgress(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const progress = Math.max(0, Math.min(100, Number(formData.get("progress") ?? 0)));
  const p = await db.challengeParticipation.findUnique({ where: { id } });
  if (!p || p.employeeId !== user.id || p.approvalStatus !== "PENDING") return;
  await db.challengeParticipation.update({ where: { id }, data: { progress } });
  revalidatePath("/gamification/challenges");
}

export async function attachChallengeProof(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const proofUrl = String(formData.get("proofUrl") ?? "");
  const p = await db.challengeParticipation.findUnique({ where: { id } });
  if (!p || p.employeeId !== user.id) return;
  await db.challengeParticipation.update({ where: { id }, data: { proofUrl } });
  revalidatePath("/gamification/challenges");
}

export async function decideChallengeParticipation(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision"));
  const p = await db.challengeParticipation.findUnique({
    where: { id },
    include: { challenge: true },
  });
  if (!p || p.approvalStatus !== "PENDING") return;

  if (decision === "APPROVED") {
    if (p.challenge.evidenceRequired && !p.proofUrl) {
      throw new Error("This challenge requires evidence before approval");
    }
    await db.challengeParticipation.update({
      where: { id },
      data: { approvalStatus: "APPROVED", progress: 100, xpAwarded: p.challenge.xp },
    });
    await awardPoints(p.employeeId, p.challenge.xp); // also runs badge engine
    await notify(
      p.employeeId,
      "APPROVAL",
      `Challenge approved: ${p.challenge.title}`,
      `You earned ${p.challenge.xp} XP!`,
      "/gamification/challenges"
    );
  } else {
    await db.challengeParticipation.update({ where: { id }, data: { approvalStatus: "REJECTED" } });
    await notify(
      p.employeeId,
      "APPROVAL",
      `Challenge submission rejected: ${p.challenge.title}`,
      "Review the requirements and try again.",
      "/gamification/challenges"
    );
  }
  revalidatePath("/gamification/challenges");
  revalidatePath("/approvals");
}

// ---------- Badges ----------

export async function createBadge(formData: FormData) {
  await requireRole("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const icon = String(formData.get("icon") ?? "🏅").trim() || "🏅";
  const ruleType = String(formData.get("ruleType") ?? "XP");
  const ruleThreshold = Number(formData.get("ruleThreshold") ?? 100);
  if (!name) return;
  await db.badge.create({ data: { name, description, icon, ruleType, ruleThreshold } });
  revalidatePath("/gamification/badges");
}

/** Re-evaluate all users against badge unlock rules (e.g. after adding a badge). */
export async function reevaluateBadges() {
  await requireRole("ADMIN", "MANAGER");
  const users = await db.user.findMany({ where: { status: "ACTIVE" } });
  for (const u of users) await runBadgeEngine(u.id);
  revalidatePath("/gamification/badges");
}

// ---------- Rewards ----------

export async function createReward(formData: FormData) {
  await requireRole("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const pointsRequired = Number(formData.get("pointsRequired") ?? 100);
  const stock = Number(formData.get("stock") ?? 10);
  if (!name) return;
  await db.reward.create({ data: { name, description, pointsRequired, stock } });
  revalidatePath("/gamification/rewards");
}

export async function redeemReward(formData: FormData) {
  const user = await requireUser();
  const rewardId = String(formData.get("rewardId"));

  // Atomic-ish redemption: stock check + points check + deduction
  const reward = await db.reward.findUnique({ where: { id: rewardId } });
  const me = await db.user.findUnique({ where: { id: user.id } });
  if (!reward || !me) return;
  if (reward.status !== "ACTIVE" || reward.stock <= 0) return;
  if (me.pointsBalance < reward.pointsRequired) return;

  await db.$transaction([
    db.reward.update({ where: { id: rewardId }, data: { stock: { decrement: 1 } } }),
    db.user.update({
      where: { id: user.id },
      data: { pointsBalance: { decrement: reward.pointsRequired } },
    }),
    db.rewardRedemption.create({
      data: { rewardId, userId: user.id, pointsSpent: reward.pointsRequired },
    }),
  ]);
  await notify(
    user.id,
    "GENERAL",
    `Reward redeemed: ${reward.name}`,
    `${reward.pointsRequired} points deducted from your balance.`,
    "/gamification/rewards"
  );
  revalidatePath("/gamification/rewards");
  revalidatePath("/", "layout");
}
