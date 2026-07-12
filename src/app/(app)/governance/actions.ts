"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { notify, notifyMany } from "@/lib/notify";
import { assertCanManageEmployee } from "@/lib/scope";
import { verifyEvidence } from "@/lib/ai";

// ---------- Policies ----------

/** Create PENDING acknowledgement records for every applicable employee. */
async function generatePendingAcks(policyId: string) {
  const policy = await db.esgPolicy.findUnique({
    where: { id: policyId },
    include: { acknowledgements: true },
  });
  if (!policy || !policy.requiresAck) return;
  const existing = new Set(policy.acknowledgements.map((a) => a.employeeId));
  const applicable = await db.user.findMany({
    where: {
      status: "ACTIVE",
      // department policy → only that department; null → everyone
      ...(policy.departmentId ? { departmentId: policy.departmentId } : {}),
    },
  });
  const fresh = applicable.filter((u) => !existing.has(u.id));
  if (fresh.length) {
    await db.policyAcknowledgement.createMany({
      data: fresh.map((u) => ({ policyId, employeeId: u.id, status: "PENDING" })),
    });
  }
}

export async function createPolicy(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const title = String(formData.get("title") ?? "").trim();
  const version = String(formData.get("version") ?? "1.0").trim();
  const category = String(formData.get("category") ?? "Governance").trim();
  const content = String(formData.get("content") ?? "").trim();
  const documentUrl = String(formData.get("documentUrl") ?? "") || null;
  const departmentId = String(formData.get("departmentId") ?? "") || null;
  const status = String(formData.get("status") ?? "DRAFT");
  const requiresAck = formData.get("requiresAck") === "on";
  if (!title || !content) return;
  const policy = await db.esgPolicy.create({
    data: { title, version, category, content, documentUrl, departmentId, status, requiresAck },
  });
  if (status === "ACTIVE") await generatePendingAcks(policy.id);
  revalidatePath("/governance/policies");
  revalidatePath("/governance");
}

/** Lifecycle: Draft → Active → Archived. Activation auto-creates pending acks. */
export async function setPolicyStatus(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) return;
  const prev = await db.esgPolicy.findUnique({ where: { id } });
  if (!prev) return;
  await db.esgPolicy.update({ where: { id }, data: { status } });
  if (status === "ACTIVE" && prev.status !== "ACTIVE") await generatePendingAcks(id);
  revalidatePath("/governance/policies");
  revalidatePath("/governance");
}

export async function acknowledgePolicy(formData: FormData) {
  const user = await requireUser();
  const policyId = String(formData.get("policyId"));
  await db.policyAcknowledgement.upsert({
    where: { policyId_employeeId: { policyId, employeeId: user.id } },
    create: { policyId, employeeId: user.id, status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
    update: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
  });
  revalidatePath("/governance/policies");
  revalidatePath("/governance");
}

export async function remindPolicy(formData: FormData) {
  const actor = await requireRole("ADMIN", "MANAGER");
  const policyId = String(formData.get("policyId"));
  const policy = await db.esgPolicy.findUnique({ where: { id: policyId } });
  if (!policy) return;
  const pending = await db.policyAcknowledgement.findMany({
    where: {
      policyId,
      status: "PENDING",
      ...(actor.role === "MANAGER" && actor.departmentId
        ? { employee: { departmentId: actor.departmentId } }
        : {}),
    },
  });
  await notifyMany(
    pending.map((p) => p.employeeId),
    "POLICY_REMINDER",
    `Please acknowledge: ${policy.title} (v${policy.version})`,
    "This policy requires your acknowledgement.",
    "/governance/policies"
  );
  revalidatePath("/governance/policies");
}

// ---------- Compliance standards (ISO 14001 / SEBI BRSR / GRI) ----------

/** Admin checkbox-assigns selected requirements to a department + responsible manager. */
export async function assignRequirements(formData: FormData) {
  await requireRole("ADMIN");
  const departmentId = String(formData.get("departmentId") ?? "");
  const ownerId = String(formData.get("ownerId") ?? "");
  const dueDateStr = String(formData.get("dueDate") ?? "");
  const requirementIds = formData.getAll("requirementIds").map(String).filter(Boolean);
  if (!departmentId || !ownerId || requirementIds.length === 0) return;
  const dueDate = dueDateStr ? new Date(dueDateStr) : null;

  let created = 0;
  for (const requirementId of requirementIds) {
    const exists = await db.complianceAssignment.findUnique({
      where: { requirementId_departmentId: { requirementId, departmentId } },
    });
    if (exists) continue;
    await db.complianceAssignment.create({
      data: { requirementId, departmentId, ownerId, dueDate },
    });
    created++;
  }
  if (created > 0) {
    const dept = await db.department.findUnique({ where: { id: departmentId } });
    await notify(
      ownerId,
      "COMPLIANCE_ISSUE",
      `Compliance assigned: ${created} requirement${created === 1 ? "" : "s"} for ${dept?.name}`,
      `You are responsible for ensuring compliance${dueDate ? ` by ${dueDate.toLocaleDateString()}` : ""}. Upload proof to close each item.`,
      "/governance/standards"
    );
  }
  revalidatePath("/governance/standards");
  revalidatePath("/governance");
}

/** Owner/manager progresses an assignment; closing as COMPLIANT requires uploaded proof. */
export async function updateAssignment(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const proofUrl = String(formData.get("proofUrl") ?? "") || null;
  if (!["PENDING", "IN_PROGRESS", "COMPLIANT"].includes(status)) return;

  const a = await db.complianceAssignment.findUnique({ where: { id }, include: { requirement: true } });
  if (!a) return;
  // owner, admin, or manager of the department
  if (user.role !== "ADMIN" && a.ownerId !== user.id) {
    if (user.role !== "MANAGER" || user.departmentId !== a.departmentId) {
      throw new Error("Not authorized");
    }
  }
  const finalProof = proofUrl ?? a.proofUrl;
  if (status === "COMPLIANT" && !finalProof) {
    throw new Error("Proof of compliance is required to close this requirement");
  }
  await db.complianceAssignment.update({
    where: { id },
    data: {
      status,
      ...(proofUrl ? { proofUrl } : {}),
      closedAt: status === "COMPLIANT" ? new Date() : null,
    },
  });

  // AI pre-screen (advisory) on newly attached compliance evidence
  if (proofUrl) {
    const ai = await verifyEvidence({
      claim: `Department evidence for compliance requirement ${a.requirement.standard.replaceAll("_", " ")} ${a.requirement.code} — ${a.requirement.title}`,
      context: a.requirement.description,
      fileUrl: proofUrl,
    });
    if (ai) {
      await db.complianceAssignment.update({
        where: { id },
        data: { aiVerdict: ai.verdict, aiConfidence: ai.confidence, aiReason: ai.reason },
      });
    }
  }
  revalidatePath("/governance/standards");
  revalidatePath("/governance");
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
