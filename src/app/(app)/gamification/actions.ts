"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { awardPoints, runBadgeEngine } from "@/lib/gamify";
import { assertCanManageEmployee } from "@/lib/scope";
import { verifyEvidence } from "@/lib/ai";

// ---------- Challenges (lifecycle: DRAFT → ACTIVE → UNDER_REVIEW → COMPLETED / ARCHIVED) ----------

const LIFECYCLE = ["DRAFT", "ACTIVE", "UNDER_REVIEW", "COMPLETED", "ARCHIVED"];

export async function createChallenge(formData: FormData) {
  const actor = await requireRole("ADMIN", "MANAGER");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const xp = Number(formData.get("xp") ?? 100);
  const difficulty = String(formData.get("difficulty") ?? "MEDIUM");
  const evidenceRequired = formData.get("evidenceRequired") === "on";
  const deadline = new Date(String(formData.get("deadline")));
  // admin assigns org-wide (or picks a department); managers assign to their own team only
  const departmentId =
    actor.role === "ADMIN"
      ? String(formData.get("departmentId") ?? "") || null
      : actor.departmentId;
  if (!title || !categoryId || isNaN(deadline.getTime())) return;
  await db.challenge.create({
    data: { title, description, categoryId, departmentId, xp, difficulty, evidenceRequired, deadline },
  });
  revalidatePath("/gamification/challenges");
  revalidatePath("/quest");
}

export async function setChallengeStatus(formData: FormData) {
  const actor = await requireRole("ADMIN", "MANAGER");
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!LIFECYCLE.includes(status)) return;
  const ch = await db.challenge.findUnique({ where: { id } });
  if (!ch) return;
  // managers run the lifecycle only for their own team's quests
  if (actor.role === "MANAGER" && ch.departmentId !== actor.departmentId) return;
  await db.challenge.update({ where: { id }, data: { status } });
  revalidatePath("/gamification/challenges");
  revalidatePath("/quest");
}

// ---------- Challenge participation ----------

export async function joinChallenge(formData: FormData) {
  const user = await requireUser();
  if (user.role === "ADMIN") return; // admins curate quests, they don't play
  const challengeId = String(formData.get("challengeId"));
  const ch = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!ch || ch.status !== "ACTIVE") return;
  // quests are joinable if org-wide or assigned to your department
  if (ch.departmentId && ch.departmentId !== user.departmentId) return;
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
  const p = await db.challengeParticipation.findUnique({
    where: { id },
    include: { challenge: { include: { category: true } } },
  });
  if (!p || p.employeeId !== user.id) return;
  await db.challengeParticipation.update({ where: { id }, data: { proofUrl } });

  // AI pre-screen (advisory): does the evidence plausibly match the challenge?
  const ai = await verifyEvidence({
    claim: `Employee completed (or made progress on) the sustainability challenge "${p.challenge.title}"`,
    context: `${p.challenge.category.name} challenge: ${p.challenge.description}`,
    fileUrl: proofUrl,
  });
  if (ai) {
    await db.challengeParticipation.update({
      where: { id },
      data: { aiVerdict: ai.verdict, aiConfidence: ai.confidence, aiReason: ai.reason },
    });
  }
  revalidatePath("/gamification/challenges");
  revalidatePath("/approvals");
  revalidatePath("/quest");
}

export async function decideChallengeParticipation(formData: FormData) {
  const actor = await requireRole("ADMIN", "MANAGER");
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision"));
  const p = await db.challengeParticipation.findUnique({
    where: { id },
    include: { challenge: true, employee: true },
  });
  if (!p || p.approvalStatus !== "PENDING") return;
  await assertCanManageEmployee(actor, p.employeeId); // managers decide only for their department
  // managers' own submissions are approved by ADMIN only
  if (p.employee.role !== "EMPLOYEE" && actor.role !== "ADMIN") {
    throw new Error("Manager submissions are approved by an admin");
  }

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
  const type = String(formData.get("type") ?? "MERCH");
  const brand = String(formData.get("brand") ?? "") || null;
  const pointsRequired = Number(formData.get("pointsRequired") ?? 100);
  const stock = Number(formData.get("stock") ?? 10);
  if (!name) return;
  await db.reward.create({ data: { name, description, type, brand, pointsRequired, stock } });
  revalidatePath("/gamification/rewards");
  revalidatePath("/quest");
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

  // gift cards get an instantly claimable voucher code
  const voucherCode =
    reward.type === "GIFT_CARD"
      ? `${(reward.brand ?? "ECO").slice(0, 4).toUpperCase()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase()}`
      : null;

  await db.$transaction([
    db.reward.update({ where: { id: rewardId }, data: { stock: { decrement: 1 } } }),
    db.user.update({
      where: { id: user.id },
      data: { pointsBalance: { decrement: reward.pointsRequired } },
    }),
    db.rewardRedemption.create({
      data: { rewardId, userId: user.id, pointsSpent: reward.pointsRequired, voucherCode },
    }),
  ]);
  // fulfillment instructions by reward type
  const fulfillment: Record<string, string> = {
    GIFT_CARD: `Your claim code: ${voucherCode}. A copy has been emailed to your work inbox — it's also saved under My Redemptions.`,
    MERCH: "A confirmation email has been sent to your work inbox — show it at the company reception to collect your item.",
    PERK: "HR has been notified — this perk will be added to your account within 2 working days. Confirmation emailed to you.",
    DONATION: "Thank you! Your donation certificate will be emailed to you once processed.",
  };
  await notify(
    user.id,
    "GENERAL",
    `Reward redeemed: ${reward.name}`,
    fulfillment[reward.type] ?? `${reward.pointsRequired} points deducted from your balance.`,
    "/quest"
  );
  revalidatePath("/quest");
  revalidatePath("/gamification/rewards");
  revalidatePath("/", "layout");
}
