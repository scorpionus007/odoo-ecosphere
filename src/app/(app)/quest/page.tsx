import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeScores } from "@/lib/scoring";
import { stationForCategory } from "@/lib/game";
import QuestWorld, {
  QuestChallenge, QuestActivity, QuestReward, QuestHero, QuestLeader,
} from "@/components/quest/QuestWorld";
import {
  joinChallenge, updateChallengeProgress, attachChallengeProof, redeemReward,
} from "../gamification/actions";
import { joinActivity, attachProof } from "../social/actions";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function QuestPage() {
  const session = await requireUser();

  const [me, challenges, activities, rewards, leaders, scores] = await Promise.all([
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
      where: { status: "ACTIVE" },
      include: { badges: { include: { badge: true } } },
      orderBy: { xpTotal: "desc" },
      take: 8,
    }),
    computeScores(),
  ]);

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
          }
        : null,
    };
  });

  const questRewards: QuestReward[] = rewards.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    pointsRequired: r.pointsRequired,
    stock: r.stock,
  }));

  const questLeaders: QuestLeader[] = leaders.map((u) => ({
    name: u.name,
    xp: u.xpTotal,
    badges: u.badges.map((b) => b.badge.icon),
    isMe: u.id === session.id,
  }));

  return (
    <>
      <PageHeader
        title="EcoQuest World"
        subtitle="Walk your hero around the eco-village — accept quests, submit proof, earn XP, unlock badges and spend points at the Trading Post"
      />
      <QuestWorld
        hero={hero}
        challenges={questChallenges}
        activities={questActivities}
        rewards={questRewards}
        leaders={questLeaders}
        orgScore={scores.overall}
        actions={{
          joinChallenge,
          updateChallengeProgress,
          attachChallengeProof,
          joinActivity,
          attachProof,
          redeemReward,
        }}
      />
      <p className="text-xs text-slate-400 mt-3">
        Click any building to walk there. ❗ = new quests · ⏳ = awaiting approval · ✅ = completed · 🪙 = you can afford
        something at the shop. Village air quality mirrors the organization&apos;s live ESG score.
      </p>
    </>
  );
}
