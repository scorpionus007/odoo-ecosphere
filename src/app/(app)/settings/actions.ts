"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/settings";

// ---------- Departments ----------

export async function createDepartment(formData: FormData) {
  await requireRole("ADMIN");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const headId = String(formData.get("headId") ?? "") || null;
  const parentId = String(formData.get("parentId") ?? "") || null;
  if (!name || !code) return;
  await db.department.create({ data: { name, code, headId, parentId } });
  revalidatePath("/settings/departments");
}

export async function updateDepartment(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const headId = String(formData.get("headId") ?? "") || null;
  const status = String(formData.get("status") ?? "ACTIVE");
  await db.department.update({ where: { id }, data: { name, headId, status } });
  revalidatePath("/settings/departments");
}

export async function toggleDepartment(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const dept = await db.department.findUnique({ where: { id } });
  if (!dept) return;
  await db.department.update({
    where: { id },
    data: { status: dept.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });
  revalidatePath("/settings/departments");
}

// ---------- Categories ----------

export async function createCategory(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "CSR");
  if (!name) return;
  await db.category.create({ data: { name, type } });
  revalidatePath("/settings/categories");
}

export async function toggleCategory(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const id = String(formData.get("id"));
  const cat = await db.category.findUnique({ where: { id } });
  if (!cat) return;
  await db.category.update({
    where: { id },
    data: { status: cat.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });
  revalidatePath("/settings/categories");
}

// ---------- Roles (Admin promotes users) ----------

export async function setUserRole(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(role)) return;
  await db.user.update({ where: { id }, data: { role } });
  revalidatePath("/settings");
}

// ---------- ESG configuration ----------

export async function saveEsgConfig(formData: FormData) {
  await requireRole("ADMIN");
  const s = await getSettings();
  s.weights = {
    env: Number(formData.get("wEnv") ?? 40),
    social: Number(formData.get("wSocial") ?? 30),
    gov: Number(formData.get("wGov") ?? 30),
  };
  s.autoEmissionCalc = formData.get("autoEmissionCalc") === "on";
  s.evidenceRequirement = formData.get("evidenceRequirement") === "on";
  s.badgeAutoAward = formData.get("badgeAutoAward") === "on";
  await saveSettings(s);
  revalidatePath("/", "layout");
}

export async function saveNotificationSettings(formData: FormData) {
  await requireRole("ADMIN");
  const s = await getSettings();
  s.notifications = {
    complianceIssue: formData.get("complianceIssue") === "on",
    approvals: formData.get("approvals") === "on",
    policyReminders: formData.get("policyReminders") === "on",
    badgeUnlocks: formData.get("badgeUnlocks") === "on",
    email: formData.get("email") === "on",
  };
  await saveSettings(s);
  revalidatePath("/settings");
}
