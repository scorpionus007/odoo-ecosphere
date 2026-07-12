import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PageHeader, Card, Table, Th, Td, Chip, Field, inputCls, btnPrimary, btnSecondary } from "@/components/ui";
import { createCategory, toggleCategory } from "../actions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requireRole("ADMIN", "MANAGER");
  const categories = await db.category.findMany({
    include: { _count: { select: { csrActivities: true, challenges: true } } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Category Management"
        subtitle="Shared category values used across Social (CSR) and Gamification (Challenges)"
      />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Create category">
          <form action={createCategory} className="space-y-3">
            <Field label="Name">
              <input name="name" required className={inputCls} />
            </Field>
            <Field label="Type">
              <select name="type" className={inputCls}>
                <option value="CSR">CSR Activity</option>
                <option value="CHALLENGE">Challenge</option>
              </select>
            </Field>
            <button className={btnPrimary}>Create</button>
          </form>
        </Card>
        <div className="lg:col-span-2">
          <Table
            head={
              <>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Used by</Th>
                <Th>Status</Th>
                <Th />
              </>
            }
          >
            {categories.map((c) => (
              <tr key={c.id}>
                <Td className="font-medium">{c.name}</Td>
                <Td>
                  <Chip label={c.type} tone={c.type === "CSR" ? "blue" : "violet"} />
                </Td>
                <Td className="text-xs text-slate-500">
                  {c._count.csrActivities} activities · {c._count.challenges} challenges
                </Td>
                <Td>
                  <Chip label={c.status} />
                </Td>
                <Td>
                  <form action={toggleCategory}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className={btnSecondary}>
                      {c.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </>
  );
}
