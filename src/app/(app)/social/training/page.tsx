import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getScope } from "@/lib/scope";
import { PageHeader, Card, Table, Th, Td, Chip, Field, inputCls, btnPrimary, btnSecondary } from "@/components/ui";
import { addTraining, completeTraining } from "../actions";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  const user = await requireUser();
  const scope = await getScope();
  const canManage = user.role === "ADMIN" || user.role === "MANAGER";
  const [records, employees] = await Promise.all([
    db.trainingRecord.findMany({
      // managers see their department; admins see all
      where: scope.departmentId ? { employee: { departmentId: scope.departmentId } } : {},
      include: { employee: { include: { department: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: { status: "ACTIVE", ...(scope.departmentId ? { departmentId: scope.departmentId } : {}) },
      orderBy: { name: "asc" },
    }),
  ]);

  const visible = canManage ? records : records.filter((r) => r.employeeId === user.id);

  return (
    <>
      <PageHeader title="Training Completion" subtitle="ESG and compliance training assignments" />
      <div className="grid lg:grid-cols-3 gap-4">
        {canManage && (
          <Card title="Assign training">
            <form action={addTraining} className="space-y-3">
              <Field label="Employee">
                <select name="employeeId" required className={inputCls}>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Course title">
                <input name="courseTitle" required placeholder="e.g. ESG Fundamentals" className={inputCls} />
              </Field>
              <button className={btnPrimary}>Assign</button>
            </form>
          </Card>
        )}
        <div className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
          <Table
            head={
              <>
                <Th>Employee</Th>
                <Th>Course</Th>
                <Th>Status</Th>
                <Th>Completed</Th>
                <Th />
              </>
            }
          >
            {visible.map((r) => (
              <tr key={r.id}>
                <Td>
                  <div className="font-medium">{r.employee.name}</div>
                  <div className="text-xs text-slate-400">{r.employee.department?.code ?? "—"}</div>
                </Td>
                <Td>{r.courseTitle}</Td>
                <Td>
                  <Chip label={r.status} />
                </Td>
                <Td>{r.completedAt ? r.completedAt.toLocaleDateString() : "—"}</Td>
                <Td>
                  {r.status !== "COMPLETED" && (r.employeeId === user.id || canManage) && (
                    <form action={completeTraining}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className={btnSecondary}>Mark complete</button>
                    </form>
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
