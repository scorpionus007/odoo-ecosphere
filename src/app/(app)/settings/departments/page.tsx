import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PageHeader, Card, Table, Th, Td, Chip, Field, inputCls, btnPrimary, btnSecondary } from "@/components/ui";
import { createDepartment, toggleDepartment } from "../actions";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  await requireRole("ADMIN");
  const departments = await db.department.findMany({
    include: { head: true, parent: true, _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });
  const users = await db.user.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader title="Department Management" subtitle="Organizational hierarchy and ESG ownership" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Create department">
          <form action={createDepartment} className="space-y-3">
            <Field label="Name">
              <input name="name" required className={inputCls} />
            </Field>
            <Field label="Code">
              <input name="code" required placeholder="e.g. MKT" className={inputCls} />
            </Field>
            <Field label="Department head">
              <select name="headId" className={inputCls} defaultValue="">
                <option value="">— none —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Parent department">
              <select name="parentId" className={inputCls} defaultValue="">
                <option value="">— none (top level) —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
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
                <Th>Code</Th>
                <Th>Head</Th>
                <Th>Parent</Th>
                <Th>Employees</Th>
                <Th>Status</Th>
                <Th />
              </>
            }
          >
            {departments.map((d) => (
              <tr key={d.id}>
                <Td className="font-medium">{d.name}</Td>
                <Td className="font-mono text-xs">{d.code}</Td>
                <Td>{d.head?.name ?? "—"}</Td>
                <Td>{d.parent?.name ?? "—"}</Td>
                <Td>{d._count.members}</Td>
                <Td>
                  <Chip label={d.status} />
                </Td>
                <Td>
                  <form action={toggleDepartment}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className={btnSecondary}>
                      {d.status === "ACTIVE" ? "Deactivate" : "Activate"}
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
