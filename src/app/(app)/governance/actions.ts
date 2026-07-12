"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { notify, notifyMany } from "@/lib/notify";
import { assertCanManageEmployee } from "@/lib/scope";

// ---------- Policies ----------

export async function createPolicy(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const title = String(formData.get("title") ?? "").trim();
  const version = String(formData.get("version") ?? "1.0").trim();
  const category = String(formData.get("category") ?? "General").trim();
  const content = String(formData.get("content") ?? "").trim();
  const requiresAck = formData.get("requiresAck") === "on";
  if (!title || !content) return;
  await db.esgPolicy.create({ data: { title, version, category, content, requiresAck } });
  revalidatePath("/governance/policies");
}

export async function acknowledgePolicy(formData: FormData) {
  const user = await requireUser();
  const policyId = String(formData.get("policyId"));
  const exists = await db.policyAcknowledgement.findUnique({
    where: { policyId_employeeId: { policyId, employeeId: user.id } },
  });
  if (exists) return;
  await db.policyAcknowledgement.create({ data: { policyId, employeeId: user.id } });
  revalidatePath("/governance/policies");
}

export async function remindPolicy(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const policyId = String(formData.get("policyId"));
  const policy = await db.esgPolicy.findUnique({
    where: { id: policyId },
    include: { acknowledgements: true },
  });
  if (!policy) return;
  const acked = new Set(policy.acknowledgements.map((a) => a.employeeId));
  const pending = await db.user.findMany({
    where: { status: "ACTIVE", id: { notIn: [...acked] } },
  });
  await notifyMany(
    pending.map((u) => u.id),
    "POLICY_REMINDER",
    `Please acknowledge: ${policy.title} (v${policy.version})`,
    "This policy requires your acknowledgement.",
    "/governance/policies"
  );
  revalidatePath("/governance/policies");
}

// ---------- Audits ----------

export async function createAudit(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const title = String(formData.get("title") ?? "").trim();
  const scope = String(formData.get("scope") ?? "") || null;
  const departmentId = String(formData.get("departmentId") ?? "") || null;
  const auditorId = String(formData.get("auditorId") ?? "") || null;
  const date = new Date(String(formData.get("date")));
  if (!title || isNaN(date.getTime())) return;
  await db.audit.create({ data: { title, scope, departmentId, auditorId, date } });
  revalidatePath("/governance/audits");
}

export async function setAuditStatus(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const findings = String(formData.get("findings") ?? "") || undefined;
  if (!["PLANNED", "IN_PROGRESS", "COMPLETED"].includes(status)) return;
  await db.audit.update({ where: { id }, data: { status, ...(findings ? { findings } : {}) } });
  revalidatePath("/governance/audits");
}

// ---------- Compliance issues ----------

export async function createIssue(formData: FormData) {
  const actor = await requireRole("ADMIN", "MANAGER");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const severity = String(formData.get("severity") ?? "MEDIUM");
  const ownerId = String(formData.get("ownerId") ?? ""); // mandatory
  const dueDate = new Date(String(formData.get("dueDate"))); // mandatory
  const auditId = String(formData.get("auditId") ?? "") || null;
  if (!title || !ownerId || isNaN(dueDate.getTime())) return;
  await assertCanManageEmployee(actor, ownerId); // managers assign owners within their department
  await db.complianceIssue.create({
    data: { title, description, severity, ownerId, dueDate, auditId },
  });
  // Notification: new compliance issue raised → owner
  await notify(
    ownerId,
    "COMPLIANCE_ISSUE",
    `Compliance issue assigned: ${title}`,
    `Severity ${severity} — due ${dueDate.toLocaleDateString()}`,
    "/governance/issues"
  );
  revalidatePath("/governance/issues");
}

export async function setIssueStatus(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status)) return;
  const issue = await db.complianceIssue.findUnique({ where: { id } });
  if (!issue) return;
  // owner themselves, admin, or a manager over the owner's department
  if (issue.ownerId !== user.id) {
    if (user.role === "EMPLOYEE") return;
    await assertCanManageEmployee(user, issue.ownerId);
  }
  await db.complianceIssue.update({ where: { id }, data: { status } });
  revalidatePath("/governance/issues");
}

/** Flags overdue OPEN/IN_PROGRESS issues and notifies owners (feeds Notification System). */
export async function flagOverdueIssues() {
  const actor = await requireRole("ADMIN", "MANAGER");
  const overdue = await db.complianceIssue.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      dueDate: { lt: new Date() },
      // managers only sweep their own department's issues
      ...(actor.role === "MANAGER" && actor.departmentId
        ? { owner: { departmentId: actor.departmentId } }
        : {}),
    },
  });
  for (const i of overdue) {
    await notify(
      i.ownerId,
      "COMPLIANCE_ISSUE",
      `OVERDUE compliance issue: ${i.title}`,
      `Was due ${i.dueDate.toLocaleDateString()} — severity ${i.severity}`,
      "/governance/issues"
    );
  }
  revalidatePath("/governance/issues");
}
