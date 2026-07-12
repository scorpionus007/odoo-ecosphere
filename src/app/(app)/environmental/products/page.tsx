import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Table, Th, Td, Chip, Field, inputCls, btnPrimary } from "@/components/ui";
import { createProduct } from "../actions";

export const dynamic = "force-dynamic";

const ratingTone: Record<string, string> = {
  "A+": "green", A: "green", B: "blue", C: "amber", D: "red",
};

export default async function ProductsPage() {
  const user = await requireUser();
  const canEdit = user.role === "ADMIN" || user.role === "MANAGER";
  const products = await db.productEsgProfile.findMany({ orderBy: { esgRating: "asc" } });

  return (
    <>
      <PageHeader
        title="Product ESG Profiles"
        subtitle="ESG information linked to products — carbon intensity, recyclability, rating"
      />
      <div className="grid lg:grid-cols-3 gap-4">
        {canEdit && (
          <Card title="Add product profile">
            <form action={createProduct} className="space-y-3">
              <Field label="Product name">
                <input name="name" required className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SKU">
                  <input name="sku" required placeholder="ECO-500" className={inputCls} />
                </Field>
                <Field label="ESG rating">
                  <select name="esgRating" className={inputCls} defaultValue="B">
                    {["A+", "A", "B", "C", "D"].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="kgCO₂e per unit">
                  <input name="carbonPerUnit" type="number" step="0.01" min="0" className={inputCls} />
                </Field>
                <Field label="Recyclable %">
                  <input name="recyclablePct" type="number" min="0" max="100" className={inputCls} />
                </Field>
              </div>
              <Field label="Notes">
                <input name="notes" className={inputCls} />
              </Field>
              <button className={btnPrimary}>Add profile</button>
            </form>
          </Card>
        )}
        <div className={canEdit ? "lg:col-span-2" : "lg:col-span-3"}>
          <Table
            head={
              <>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th>CO₂e / unit</Th>
                <Th>Recyclable</Th>
                <Th>Rating</Th>
              </>
            }
          >
            {products.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium">{p.name}</Td>
                <Td className="font-mono text-xs">{p.sku}</Td>
                <Td>{p.carbonPerUnit} kg</Td>
                <Td>{p.recyclablePct}%</Td>
                <Td>
                  <Chip label={p.esgRating} tone={ratingTone[p.esgRating] ?? "gray"} />
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
