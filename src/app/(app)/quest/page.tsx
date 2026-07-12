import { db } from "@/lib/db";
import { getScope } from "@/lib/scope";
import { computeScores } from "@/lib/scoring";
import { stationForCategory } from "@/lib/game";
import QuestWorld3D from "@/components/quest/QuestWorld3D";
import type {
  QuestChallenge, QuestActivity, QuestReward, QuestHero, QuestLeader, QuestRedemption,
} from "@/components/quest/QuestWorld3D";
import {
  joinChallenge, updateChallengeProgress, attachChallengeProof, redeemReward,
} from "../gamification/actions";
import { joinActivity, attachProof } from "../social/actions";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function QuestPage() {
  const scope = await getScope();
  const session = scope.user;

  const [me, challenges, activities, rewards, leaders, scores, redemptions] = await Promise.all([
    db.user.findUnique({
      where: { id: session.id },
      include: { badges: { include: { badge: true } } },
    }),
    db.challenge.findMany({
      where: { status: "ACTIVE" },
      include: { category: true, participations: { where: { employeeId: session.id } } },
      orderBy: { deadline: "asc" },
    }),
    db.csrActivity.findMany({
      where: { status: { in: ["UPCOMING", "ONGOING"] } },
      include: { participations: { where: { employeeId: session.id } } },
      orderBy: { date: "asc" },
    }),
    db.reward.findMany({ where: { status: "ACTIVE" }, orderBy: { pointsRequired: "asc" } }),
    db.user.findMany({
      // Hall of Fame is department-scoped for non-admins
      where: { status: "ACTIVE", ...(scope.departmentId ? { departmentId: scope.departmentId } : {}) },
      include: { badges: { include: { badge: true } } },
      orderBy: { xpTotal: "desc" },
      take: 8,
    }),
    computeScores(),
    db.rewardRedemption.findMany({
      where: { userId: session.id },
      include: { reward: true },
      orderBy: { redeemedAt: "desc" },
      take: 20,
    }),
  ]);

  // village air quality: org score for admins, own-department score otherwise
  const airScore = scope.isAdmin
    ? scores.overall
    : scores.departments.find((d) => d.departmentId === scope.departmentId)?.totalScore ?? scores.overall;

  const hero: QuestHero = {
    name: me?.name ?? "Hero",
    xp: me?.xpTotal ?? 0,
    points: me?.pointsBalance ?? 0,
    badges: (me?.badges ?? []).map((b) => ({ icon: b.badge.icon, name: b.badge.name })),
  };

  const questChallenges: QuestChallenge[] = challenges.map((c) => {
    const mine = c.participations[0];
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      xp: c.xp,
      difficulty: c.difficulty,
      evidenceRequired: c.evidenceRequired,
      deadline: c.deadline.toISOString(),
      station: stationForCategory(c.category.name),
      mine: mine
        ? {
            id: mine.id,
            progress: mine.progress,
            approvalStatus: mine.approvalStatus,
            proofUrl: mine.proofUrl,
            xpAwarded: mine.xpAwarded,
            aiVerdict: mine.aiVerdict,
            aiConfidence: mine.aiConfidence,
            aiReason: mine.aiReason,
          }
        : null,
    };
  });

  const questActivities: QuestActivity[] = activities.map((a) => {
    const mine = a.participations[0];
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      points: a.pointsReward,
      date: a.date.toISOString(),
      location: a.location,
      status: a.status,
      mine: mine
        ? {
            id: mine.id,
            approvalStatus: mine.approvalStatus,
            proofUrl: mine.proofUrl,
            pointsEarned: mine.pointsEarned,
            aiVerdict: mine.aiVerdict,
            aiConfidence: mine.aiConfidence,
            aiReason: mine.aiReason,
          }
        : null,
    };
  });

  const questRewards: QuestReward[] = rewards.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type,
    brand: r.brand,
    pointsRequired: r.pointsRequired,
    stock: r.stock,
  }));

  const questLeaders: QuestLeader[] = leaders.map((u) => ({
    name: u.name,
    xp: u.xpTotal,
    badges: u.badges.map((b) => b.badge.icon),
    isMe: u.id === session.id,
  }));

  const questRedemptions: QuestRedemption[] = redemptions.map((r) => ({
    id: r.id,
    rewardName: r.reward.name,
    type: r.reward.type,
    pointsSpent: r.pointsSpent,
    voucherCode: r.voucherCode,
    redeemedAt: r.redeemedAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        title="EcoQuest World"
        subtitle={`Walk your hero around the eco-village — accept quests, earn XP, unlock badges and claim gift cards at the Trading Post${
          scope.isAdmin ? "" : ` · Hall of Fame shows ${scope.departmentName ?? "your department"}`
        }`}
      />
      <QuestWorld3D
        hero={hero}
        challenges={questChallenges}
        activities={questActivities}
        rewards={questRewards}
        leaders={questLeaders}
        redemptions={questRedemptions}
        orgScore={airScore}
        airLabel={scope.isAdmin ? "Organization ESG" : `${scope.departmentName ?? "Department"} ESG`}
        actions={{
          joinChallenge,
          updateChallengeProgress,
          attachChallengeProof,
          joinActivity,
          attachProof,
          redeemReward,
        }}
      />
    </>
  );
}
