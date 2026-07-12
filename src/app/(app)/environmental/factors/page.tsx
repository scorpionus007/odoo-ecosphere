import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Table, Th, Td, Chip, Field, inputCls, btnPrimary, btnSecondary } from "@/components/ui";
import { createFactor, toggleFactor } from "../actions";

export const dynamic = "force-dynamic";

export default async function FactorsPage() {
  const user = await requireUser();
  const canEdit = user.role === "ADMIN" || user.role === "MANAGER";
  const factors = await db.emissionFactor.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader
        title="Emission Factors"
        subtitle="Carbon values used when converting operational data into CO₂e"
      />
      <div className="grid lg:grid-cols-3 gap-4">
        {canEdit && (
          <Card title="Add emission factor">
            <form action={createFactor} className="space-y-3">
              <Field label="Name">
                <input name="name" required placeholder="e.g. Grid Electricity" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Source module">
                  <select name="sourceModule" className={inputCls}>
                    <option value="PURCHASE">Purchase</option>
                    <option value="MANUFACTURING">Manufacturing</option>
                    <option value="EXPENSE">Expense</option>
                    <option value="FLEET">Fleet</option>
                  </select>
                </Field>
                <Field label="GHG scope">
                  <select name="scope" className={inputCls}>
                    <option value="1">Scope 1</option>
                    <option value="2">Scope 2</option>
                    <option value="3">Scope 3</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unit">
                  <input name="unit" required placeholder="kWh / litre / km / kg" className={inputCls} />
                </Field>
                <Field label="kgCO₂e per unit">
                  <input name="kgCo2ePerUnit" required type="number" step="0.001" min="0.001" className={inputCls} />
                </Field>
              </div>
              <button className={btnPrimary}>Add factor</button>
            </form>
          </Card>
        )}
        <div className={canEdit ? "lg:col-span-2" : "lg:col-span-3"}>
          <Table
            head={
              <>
                <Th>Name</Th>
                <Th>Module</Th>
                <Th>Scope</Th>
                <Th>Factor</Th>
                <Th>Status</Th>
                {canEdit && <Th />}
              </>
            }
          >
            {factors.map((f) => (
              <tr key={f.id}>
                <Td className="font-medium">{f.name}</Td>
                <Td>
                  <Chip label={f.sourceModule} tone="blue" />
                </Td>
                <Td>Scope {f.scope}</Td>
                <Td>
                  {f.kgCo2ePerUnit} kgCO₂e / {f.unit}
                </Td>
                <Td>
                  <Chip label={f.status} />
                </Td>
                {canEdit && (
                  <Td>
                    <form action={toggleFactor}>
                      <input type="hidden" name="id" value={f.id} />
                      <button className={btnSecondary}>
                        {f.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    </form>
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
