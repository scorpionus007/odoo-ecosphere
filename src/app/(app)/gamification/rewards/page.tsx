import { db } from "@/lib/db";
import { requireUser, currentUser } from "@/lib/auth";
import { PageHeader, Card, Chip, Field, inputCls, btnPrimary, Table, Th, Td, EmptyState } from "@/components/ui";
import { createReward, redeemReward } from "../actions";
import { Gift, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const session = await requireUser();
  const me = await currentUser();
  const isAdmin = session.role === "ADMIN";
  const [rewards, myRedemptions] = await Promise.all([
    db.reward.findMany({ orderBy: { pointsRequired: "asc" } }),
    db.rewardRedemption.findMany({
      where: { userId: session.id },
      include: { reward: true },
      orderBy: { redeemedAt: "desc" },
    }),
  ]);
  const balance = me?.pointsBalance ?? 0;

  return (
    <>
      <PageHeader
        title="Rewards Catalog"
        subtitle="Redeem earned points — redemption deducts points and reduces stock"
        actions={
          <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 px-4 py-1.5 text-sm font-bold">
            <Sparkles size={14} /> {balance} points available
          </div>
        }
      />
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {isAdmin && (
          <Card title="Add reward">
            <form action={createReward} className="space-y-3">
              <Field label="Name">
                <input name="name" required className={inputCls} />
              </Field>
              <Field label="Description">
                <input name="description" required className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select name="type" className={inputCls} defaultValue="MERCH">
                    <option value="GIFT_CARD">Gift card (claim code)</option>
                    <option value="PERK">Perk</option>
                    <option value="MERCH">Merch</option>
                    <option value="DONATION">Donation</option>
                  </select>
                </Field>
                <Field label="Brand (gift cards)">
                  <input name="brand" placeholder="Amazon / Starbucks…" className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Points required">
                  <input name="pointsRequired" type="number" min="1" defaultValue={100} className={inputCls} />
                </Field>
                <Field label="Stock">
                  <input name="stock" type="number" min="0" defaultValue={10} className={inputCls} />
                </Field>
              </div>
              <button className={btnPrimary}>Add reward</button>
            </form>
          </Card>
        )}
        <div
          className={`grid sm:grid-cols-2 gap-4 content-start ${
            isAdmin ? "lg:col-span-2" : "lg:col-span-3 sm:grid-cols-3"
          }`}
        >
          {rewards.map((r) => {
            const affordable = balance >= r.pointsRequired;
            const inStock = r.stock > 0 && r.status === "ACTIVE";
            return (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
                      <Gift size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.description}</div>
                      <div className="text-xs mt-1.5 flex items-center gap-2">
                        <span className="font-bold text-violet-600 dark:text-violet-300">
                          {r.pointsRequired} pts
                        </span>
                        <Chip label={inStock ? `${r.stock} in stock` : "Out of stock"} tone={inStock ? "green" : "red"} />
                      </div>
                    </div>
                  </div>
                </div>
                <form action={redeemReward} className="mt-3">
                  <input type="hidden" name="rewardId" value={r.id} />
                  <button
                    disabled={!affordable || !inStock}
                    title={!inStock ? "Out of stock" : !affordable ? "Not enough points" : undefined}
                    className={`${btnPrimary} w-full justify-center disabled:cursor-not-allowed`}
                  >
                    {inStock ? (affordable ? "Redeem" : "Not enough points") : "Out of stock"}
                  </button>
                </form>
              </Card>
            );
          })}
        </div>
      </div>

      <Card title="My redemptions">
        {myRedemptions.length === 0 ? (
          <EmptyState message="Nothing redeemed yet — earn points via CSR activities and challenges" />
        ) : (
          <Table
            head={
              <>
                <Th>Reward</Th>
                <Th>Points spent</Th>
                <Th>Claim code</Th>
                <Th>Status</Th>
                <Th>Date</Th>
              </>
            }
          >
            {myRedemptions.map((r) => (
              <tr key={r.id}>
                <Td className="font-medium">{r.reward.name}</Td>
                <Td>{r.pointsSpent}</Td>
                <Td>
                  {r.voucherCode ? (
                    <span className="font-mono text-xs bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded px-2 py-0.5">
                      {r.voucherCode}
                    </span>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  <Chip label={r.status} />
                </Td>
                <Td>{r.redeemedAt.toLocaleString()}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
