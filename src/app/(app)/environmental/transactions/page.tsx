import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getScope } from "@/lib/scope";
import { getSettings } from "@/lib/settings";
import { PageHeader, Card, Table, Th, Td, Chip, Field, inputCls, btnPrimary, StatCard } from "@/components/ui";
import { createManualTransaction } from "../actions";
import { Flame } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; source?: string }>;
}) {
  const { dept, source } = await searchParams;
  const user = await requireUser();
  const scope = await getScope();
  const canEdit = user.role === "ADMIN" || user.role === "MANAGER";

  const where: Record<string, unknown> = {};
  // non-admins are pinned to their own department regardless of filter input
  if (scope.departmentId) where.departmentId = scope.departmentId;
  else if (dept) where.departmentId = dept;
  if (source) where.source = source;

  const [txs, departments, factors, settings, total] = await Promise.all([
    db.carbonTransaction.findMany({
      where,
      include: { department: true, emissionFactor: true, operationalRecord: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    db.department.findMany({ where: scope.departmentId ? { id: scope.departmentId } : {} }),
    db.emissionFactor.findMany({ where: { status: "ACTIVE" } }),
    getSettings(),
    db.carbonTransaction.aggregate({ where, _sum: { co2eKg: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Carbon Transactions"
        subtitle="Calculated emissions from ERP operations (auto) and manual entries"
      />

      {/* filters */}
      <form method="GET" className="flex flex-wrap gap-2 mb-4 items-end">
        <Field label="Department">
          <select name="dept" defaultValue={dept ?? ""} className={inputCls}>
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <select name="source" defaultValue={source ?? ""} className={inputCls}>
            <option value="">All</option>
            {["PURCHASE", "MANUFACTURING", "EXPENSE", "FLEET", "MANUAL"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <button className={btnPrimary}>Filter</button>
        <div className="ml-auto">
          <StatCard
            label="Filtered total"
            value={`${Math.round(total._sum.co2eKg ?? 0).toLocaleString()} kg`}
            icon={<Flame size={18} />}
            tone="amber"
          />
        </div>
      </form>

      <div className="grid lg:grid-cols-3 gap-4">
        {canEdit && (
          <Card title={`Manual carbon transaction ${settings.autoEmissionCalc ? "(auto-calc is ON — use for corrections)" : ""}`}>
            <form action={createManualTransaction} className="space-y-3">
              <Field label="Emission factor">
                <select name="emissionFactorId" required className={inputCls}>
                  {factors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.kgCo2ePerUnit} kg/{f.unit})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Department">
                <select name="departmentId" required className={inputCls}>
                  {departments
                    .filter((d) => d.status === "ACTIVE")
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Quantity">
                <input name="quantity" type="number" step="0.01" min="0.01" required className={inputCls} />
              </Field>
              <button className={btnPrimary}>Add transaction</button>
            </form>
          </Card>
        )}
        <div className={canEdit ? "lg:col-span-2" : "lg:col-span-3"}>
          <Table
            head={
              <>
                <Th>Date</Th>
                <Th>Source</Th>
                <Th>Factor</Th>
                <Th>Dept</Th>
                <Th>Qty</Th>
                <Th>kgCO₂e</Th>
                <Th>Mode</Th>
              </>
            }
          >
            {txs.map((t) => (
              <tr key={t.id}>
                <Td className="whitespace-nowrap">{t.date.toLocaleDateString()}</Td>
                <Td>
                  <Chip label={t.source} tone="blue" />
                </Td>
                <Td>{t.emissionFactor.name}</Td>
                <Td>{t.department.code}</Td>
                <Td>
                  {t.quantity} {t.emissionFactor.unit}
                </Td>
                <Td className="font-semibold text-amber-600 dark:text-amber-400">
                  {t.co2eKg.toLocaleString()}
                </Td>
                <Td>
                  <Chip label={t.auto ? "AUTO" : "MANUAL"} tone={t.auto ? "green" : "gray"} />
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
