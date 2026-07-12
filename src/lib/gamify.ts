import { db } from "./db";
import { getSettings } from "./settings";
import { notify } from "./notify";

/**
 * Award XP + redeemable points to a user, then run the badge auto-award engine.
 * Both CSR points and Challenge XP feed xpTotal (lifetime) and pointsBalance (spendable).
 */
export async function awardPoints(userId: string, amount: number) {
  await db.user.update({
    where: { id: userId },
    data: { xpTotal: { increment: amount }, pointsBalance: { increment: amount } },
  });
  await runBadgeEngine(userId);
}

/**
 * Badge auto-award: assigns any badge whose Unlock Rule (XP threshold or
 * completed-challenge count) the user now satisfies. Gated by the settings toggle.
 */
export async function runBadgeEngine(userId: string) {
  const settings = await getSettings();
  if (!settings.badgeAutoAward) return;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { badges: true },
  });
  if (!user) return;

  const completedChallenges = await db.challengeParticipation.count({
    where: { employeeId: userId, approvalStatus: "APPROVED" },
  });

  const badges = await db.badge.findMany({ where: { status: "ACTIVE" } });
  const held = new Set(user.badges.map((b) => b.badgeId));

  for (const badge of badges) {
    if (held.has(badge.id)) continue;
    const metric = badge.ruleType === "XP" ? user.xpTotal : completedChallenges;
    if (metric >= badge.ruleThreshold) {
      await db.userBadge.create({ data: { userId, badgeId: badge.id } });
      await notify(
        userId,
        "BADGE_UNLOCK",
        `Badge unlocked: ${badge.name} ${badge.icon}`,
        badge.description,
        "/gamification/badges"
      );
    }
  }
}
