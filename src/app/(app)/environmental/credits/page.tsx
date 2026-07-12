import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Table, Th, Td, Chip, Field, inputCls, btnPrimary, btnSecondary, StatCard, ProgressBar } from "@/components/ui";
import { createCredit, retireCredit } from "../actions";
import { Leaf, Flame, Scale3d, BadgeCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const [credits, gross] = await Promise.all([
    db.carbonCredit.findMany({ orderBy: { purchasedAt: "desc" } }),
    db.carbonTransaction.aggregate({ _sum: { co2eKg: true } }),
  ]);

  const grossT = (gross._sum.co2eKg ?? 0) / 1000;
  const retiredT = credits.filter((c) => c.status === "RETIRED").reduce((a, c) => a + c.tonnes, 0);
  const purchasedT = credits.filter((c) => c.status === "PURCHASED").reduce((a, c) => a + c.tonnes, 0);
  const netT = Math.max(0, grossT - retiredT);
  const offsetPct = grossT > 0 ? Math.min(100, Math.round((retiredT / grossT) * 100)) : 0;

  return (
    <>
      <PageHeader
        title="Carbon Credits & Offsets"
        subtitle="Measure → reduce → offset the residual. Only retired credits count as offsets — shown separately from reductions, never blended."
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <StatCard label="Gross emissions" value={`${grossT.toFixed(1)} t`} hint="CO₂e all-time" icon={<Flame size={18} />} tone="amber" />
        <StatCard label="Offsets retired" value={`${retiredT.toFixed(1)} t`} hint={`+${purchasedT.toFixed(1)} t purchased, not yet retired`} icon={<BadgeCheck size={18} />} tone="emerald" />
        <StatCard label="Net emissions" value={`${netT.toFixed(1)} t`} icon={<Scale3d size={18} />} tone="sky" />
        <StatCard label="Path to net zero" value={`${offsetPct}%`} hint="of gross offset" icon={<Leaf size={18} />} tone="violet" />
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span>Net-zero progress (retired offsets vs gross emissions)</span>
          <span>
            {retiredT.toFixed(1)} / {grossT.toFixed(1)} t
          </span>
        </div>
        <ProgressBar value={offsetPct} tone={offsetPct >= 75 ? "emerald" : offsetPct >= 30 ? "amber" : "rose"} />
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {isAdmin && (
          <Card title="Record credit purchase">
            <form action={createCredit} className="space-y-3">
              <Field label="Project name">
                <input name="projectName" required placeholder="e.g. Rajasthan Solar Aggregation" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Registry">
                  <select name="registry" className={inputCls} defaultValue="VERRA">
                    <option value="VERRA">Verra (VCS)</option>
                    <option value="GOLD_STANDARD">Gold Standard</option>
                    <option value="CCTS">India CCTS</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Vintage year">
                  <input name="vintage" type="number" min="2000" max="2030" className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tonnes CO₂e">
                  <input name="tonnes" type="number" step="0.1" min="0.1" required className={inputCls} />
                </Field>
                <Field label="Price / tonne (₹)">
                  <input name="pricePerTonne" type="number" step="1" className={inputCls} />
                </Field>
              </div>
              <button className={btnPrimary}>Record purchase</button>
            </form>
          </Card>
        )}
        <div className={isAdmin ? "lg:col-span-2" : "lg:col-span-3"}>
          <Table
            head={
              <>
                <Th>Project</Th>
                <Th>Registry</Th>
                <Th>Vintage</Th>
                <Th>Tonnes</Th>
                <Th>Price/t</Th>
                <Th>Status</Th>
                {isAdmin && <Th />}
              </>
            }
          >
            {credits.map((c) => (
              <tr key={c.id}>
                <Td className="font-medium">{c.projectName}</Td>
                <Td>
                  <Chip label={c.registry.replaceAll("_", " ")} tone="blue" />
                </Td>
                <Td>{c.vintage ?? "—"}</Td>
                <Td className="font-semibold">{c.tonnes} t</Td>
                <Td>{c.pricePerTonne ? `₹${c.pricePerTonne}` : "—"}</Td>
                <Td>
                  <Chip label={c.status} tone={c.status === "RETIRED" ? "green" : "amber"} />
                  {c.retiredAt && (
                    <div className="text-[10px] text-slate-400 mt-0.5">{c.retiredAt.toLocaleDateString()}</div>
                  )}
                </Td>
                {isAdmin && (
                  <Td>
                    {c.status === "PURCHASED" && (
                      <form action={retireCredit}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className={btnSecondary} title="Retire the credit so it counts as an offset">
                          Retire
                        </button>
                      </form>
                    )}
                  </Td>
                )}
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
