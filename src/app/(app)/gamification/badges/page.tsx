import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Chip, Field, inputCls, btnPrimary, btnSecondary } from "@/components/ui";
import { createBadge, reevaluateBadges } from "../actions";
import { RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const user = await requireUser();
  const canManage = user.role === "ADMIN" || user.role === "MANAGER";
  const badges = await db.badge.findMany({
    include: { holders: { include: { user: true } } },
    orderBy: { ruleThreshold: "asc" },
  });
  const myBadges = new Set(
    badges.flatMap((b) => b.holders.filter((h) => h.userId === user.id).map(() => b.id))
  );

  return (
    <>
      <PageHeader
        title="Badges"
        subtitle="Auto-awarded when XP or completed-challenge count satisfies the unlock rule"
        actions={
          canManage ? (
            <form action={reevaluateBadges}>
              <button className={btnSecondary}>
                <RefreshCw size={14} /> Re-evaluate all users
              </button>
            </form>
          ) : undefined
        }
      />
      <div className="grid lg:grid-cols-3 gap-4">
        {user.role === "ADMIN" && (
          <Card title="Create badge">
            <form action={createBadge} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Icon">
                  <input name="icon" defaultValue="🏅" className={inputCls} />
                </Field>
                <div className="col-span-2">
                  <Field label="Name">
                    <input name="name" required className={inputCls} />
                  </Field>
                </div>
              </div>
              <Field label="Description">
                <input name="description" required className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unlock rule">
                  <select name="ruleType" className={inputCls}>
                    <option value="XP">Total XP ≥</option>
                    <option value="CHALLENGES">Challenges completed ≥</option>
                  </select>
                </Field>
                <Field label="Threshold">
                  <input name="ruleThreshold" type="number" min="1" defaultValue={100} className={inputCls} />
                </Field>
              </div>
              <button className={btnPrimary}>Create badge</button>
            </form>
          </Card>
        )}
        <div
          className={`grid sm:grid-cols-2 gap-4 content-start ${
            user.role === "ADMIN" ? "lg:col-span-2" : "lg:col-span-3 sm:grid-cols-3"
          }`}
        >
          {badges.map((b) => {
            const held = myBadges.has(b.id);
            return (
              <Card key={b.id} className={held ? "ring-2 ring-emerald-500/60" : ""}>
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{b.icon}</div>
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      {b.name}
                      {held && <Chip label="Unlocked" tone="green" />}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{b.description}</div>
                    <div className="text-[11px] text-slate-400 mt-1.5">
                      Rule: {b.ruleType === "XP" ? `${b.ruleThreshold}+ XP` : `${b.ruleThreshold}+ challenges completed`}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {b.holders.length} holder{b.holders.length === 1 ? "" : "s"}
                      {b.holders.length > 0 && ": " + b.holders.map((h) => h.user.name.split(" ")[0]).join(", ")}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
