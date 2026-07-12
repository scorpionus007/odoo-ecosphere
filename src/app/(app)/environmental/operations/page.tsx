import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader, Card, Table, Th, Td, Chip, Field, inputCls, btnPrimary } from "@/components/ui";
import { createOperation } from "../actions";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const [records, departments, factors, settings] = await Promise.all([
    db.operationalRecord.findMany({
      include: { department: true, emissionFactor: true, carbonTransaction: true },
      orderBy: { date: "desc" },
      take: 100,
    }),
    db.department.findMany({ where: { status: "ACTIVE" } }),
    db.emissionFactor.findMany({ where: { status: "ACTIVE" } }),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Daily Business Operations"
        subtitle={`Purchase · Manufacturing · Expenses · Fleet — auto emission calculation is ${
          settings.autoEmissionCalc ? "ON: linked records generate carbon transactions automatically" : "OFF: add carbon transactions manually"
        }`}
      />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Record operation">
          <form action={createOperation} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select name="type" className={inputCls}>
                  <option value="PURCHASE">Purchase</option>
                  <option value="MANUFACTURING">Manufacturing</option>
                  <option value="EXPENSE">Expense</option>
                  <option value="FLEET">Fleet</option>
                </select>
              </Field>
              <Field label="Department">
                <select name="departmentId" required className={inputCls}>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <input name="description" required placeholder="e.g. Diesel refill Route B" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity">
                <input name="quantity" type="number" step="0.01" min="0.01" required className={inputCls} />
              </Field>
              <Field label="Unit">
                <input name="unit" placeholder="kWh / litre / km / kg" className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹, optional)">
                <input name="amount" type="number" step="0.01" className={inputCls} />
              </Field>
              <Field label="Date">
                <input name="date" type="date" className={inputCls} />
              </Field>
            </div>
            <Field label="Emission factor (drives auto CO₂e)">
              <select name="emissionFactorId" className={inputCls} defaultValue="">
                <option value="">— none —</option>
                {factors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.kgCo2ePerUnit} kg/{f.unit})
                  </option>
                ))}
              </select>
            </Field>
            <button className={btnPrimary}>Save operation</button>
          </form>
        </Card>

        <div className="lg:col-span-2">
          <Table
            head={
              <>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Description</Th>
                <Th>Dept</Th>
                <Th>Qty</Th>
                <Th>CO₂e</Th>
              </>
            }
          >
            {records.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap">{r.date.toLocaleDateString()}</Td>
                <Td>
                  <Chip label={r.type} tone="blue" />
                </Td>
                <Td className="max-w-[260px] truncate">{r.description}</Td>
                <Td>{r.department.code}</Td>
                <Td>
                  {r.quantity} {r.unit}
                </Td>
                <Td>
                  {r.carbonTransaction ? (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {r.carbonTransaction.co2eKg.toLocaleString()} kg
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">not calculated</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
