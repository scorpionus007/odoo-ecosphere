import { requireUser, SessionUser } from "./auth";
import { db } from "./db";

/**
 * Department-scoped RBAC.
 *
 * ADMIN     → organization-wide data everywhere.
 * MANAGER   → locked to their own department: dashboards, analytics, lists,
 *             approvals and reports only cover their department's people/data.
 * EMPLOYEE  → same department lock for analytics; personal data for
 *             participations/issues/training.
 */
export type Scope = {
  user: SessionUser;
  isAdmin: boolean;
  /** null for admins (no restriction), otherwise the user's department id */
  departmentId: string | null;
  /** Prisma where-fragment for models with a departmentId column */
  deptWhere: { departmentId?: string };
  /** Prisma where-fragment for models related to an employee (User) */
  employeeDeptWhere: { employee?: { departmentId: string } };
  departmentName: string | null;
};

export async function getScope(): Promise<Scope> {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const departmentId = isAdmin ? null : user.departmentId;
  let departmentName: string | null = null;
  if (departmentId) {
    const d = await db.department.findUnique({ where: { id: departmentId } });
    departmentName = d?.name ?? null;
  }
  return {
    user,
    isAdmin,
    departmentId,
    deptWhere: departmentId ? { departmentId } : {},
    employeeDeptWhere: departmentId ? { employee: { departmentId } } : {},
    departmentName,
  };
}

/** Throws unless the actor is an admin, or a manager over the target employee's department. */
export async function assertCanManageEmployee(actor: SessionUser, employeeId: string) {
  if (actor.role === "ADMIN") return;
  if (actor.role !== "MANAGER") throw new Error("Not authorized");
  const target = await db.user.findUnique({ where: { id: employeeId } });
  if (!target || !actor.departmentId || target.departmentId !== actor.departmentId) {
    throw new Error("Not authorized: employee is outside your department");
  }
}
