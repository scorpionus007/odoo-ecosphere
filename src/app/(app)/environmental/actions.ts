"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

// ---------- Emission factors ----------

export async function createFactor(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const name = String(formData.get("name") ?? "").trim();
  const sourceModule = String(formData.get("sourceModule") ?? "PURCHASE");
  const unit = String(formData.get("unit") ?? "").trim();
  const kgCo2ePerUnit = Number(formData.get("kgCo2ePerUnit") ?? 0);
  const scope = Number(formData.get("scope") ?? 1);
  if (!name || !unit || kgCo2ePerUnit <= 0) return;
  await db.emissionFactor.create({ data: { name, sourceModule, unit, kgCo2ePerUnit, scope } });
  revalidatePath("/environmental/factors");
}

export async function toggleFactor(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const id = String(formData.get("id"));
  const f = await db.emissionFactor.findUnique({ where: { id } });
  if (!f) return;
  await db.emissionFactor.update({
    where: { id },
    data: { status: f.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });
  revalidatePath("/environmental/factors");
}

// ---------- Operational records (Purchase / Manufacturing / Expense / Fleet) ----------

export async function createOperation(formData: FormData) {
  const actor = await requireUser();
  const type = String(formData.get("type") ?? "PURCHASE");
  const description = String(formData.get("description") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);
  const unit = String(formData.get("unit") ?? "").trim();
  const amount = formData.get("amount") ? Number(formData.get("amount")) : null;
  // non-admins always record against their own department
  const departmentId =
    actor.role === "ADMIN"
      ? String(formData.get("departmentId") ?? "")
      : actor.departmentId ?? "";
  const emissionFactorId = String(formData.get("emissionFactorId") ?? "") || null;
  const dateStr = String(formData.get("date") ?? "");
  if (!description || quantity <= 0 || !departmentId) return;

  const record = await db.operationalRecord.create({
    data: {
      type,
      description,
      quantity,
      unit,
      amount,
      departmentId,
      emissionFactorId,
      date: dateStr ? new Date(dateStr) : new Date(),
    },
  });

  // Auto Emission Calculation (Settings toggle): linked factor -> carbon transaction, no manual entry
  const settings = await getSettings();
  if (settings.autoEmissionCalc && emissionFactorId) {
    const factor = await db.emissionFactor.findUnique({ where: { id: emissionFactorId } });
    if (factor && factor.status === "ACTIVE") {
      await db.carbonTransaction.create({
        data: {
          operationalRecordId: record.id,
          emissionFactorId: factor.id,
          departmentId,
          source: type,
          quantity,
          co2eKg: Math.round(quantity * factor.kgCo2ePerUnit * 100) / 100,
          auto: true,
          date: record.date,
        },
      });
    }
  }
  revalidatePath("/environmental");
  revalidatePath("/environmental/operations");
  revalidatePath("/environmental/transactions");
}

// Manual carbon transaction (used when auto-calc is off, or for corrections)
export async function createManualTransaction(formData: FormData) {
  const actor = await requireRole("ADMIN", "MANAGER");
  const emissionFactorId = String(formData.get("emissionFactorId") ?? "");
  // managers correct only their own department's ledger
  const departmentId =
    actor.role === "ADMIN"
      ? String(formData.get("departmentId") ?? "")
      : actor.departmentId ?? "";
  const quantity = Number(formData.get("quantity") ?? 0);
  if (!emissionFactorId || !departmentId || quantity <= 0) return;
  const factor = await db.emissionFactor.findUnique({ where: { id: emissionFactorId } });
  if (!factor) return;
  await db.carbonTransaction.create({
    data: {
      emissionFactorId,
      departmentId,
      source: "MANUAL",
      quantity,
      co2eKg: Math.round(quantity * factor.kgCo2ePerUnit * 100) / 100,
      auto: false,
    },
  });
  revalidatePath("/environmental/transactions");
  revalidatePath("/environmental");
}

// ---------- Goals ----------

export async function createGoal(formData: FormData) {
  const actor = await requireRole("ADMIN", "MANAGER");
  const title = String(formData.get("title") ?? "").trim();
  const metric = String(formData.get("metric") ?? "").trim();
  const unit = String(formData.get("unit") ?? "kgCO2e").trim();
  const baseline = Number(formData.get("baseline") ?? 0);
  const target = Number(formData.get("target") ?? 0);
  const currentValue = Number(formData.get("currentValue") ?? baseline);
  const deadline = new Date(String(formData.get("deadline")));
  // managers create goals only for their own department
  const departmentId =
    actor.role === "ADMIN"
      ? String(formData.get("departmentId") ?? "") || null
      : actor.departmentId;
  if (!title || !metric || isNaN(deadline.getTime())) return;
  await db.environmentalGoal.create({
    data: { title, metric, unit, baseline, target, currentValue, deadline, departmentId },
  });
  revalidatePath("/environmental/goals");
}

export async function updateGoalProgress(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const id = String(formData.get("id"));
  const currentValue = Number(formData.get("currentValue") ?? 0);
  const goal = await db.environmentalGoal.findUnique({ where: { id } });
  if (!goal) return;
  const achieved =
    goal.target >= goal.baseline ? currentValue >= goal.target : currentValue <= goal.target;
  await db.environmentalGoal.update({
    where: { id },
    data: {
      currentValue,
      status: achieved ? "ACHIEVED" : goal.deadline < new Date() ? "MISSED" : "ACTIVE",
    },
  });
  revalidatePath("/environmental/goals");
  revalidatePath("/environmental");
}

// ---------- Carbon credits (offsets: only RETIRED credits count) ----------

export async function createCredit(formData: FormData) {
  await requireRole("ADMIN");
  const projectName = String(formData.get("projectName") ?? "").trim();
  const registry = String(formData.get("registry") ?? "VERRA");
  const vintage = formData.get("vintage") ? Number(formData.get("vintage")) : null;
  const tonnes = Number(formData.get("tonnes") ?? 0);
  const pricePerTonne = formData.get("pricePerTonne") ? Number(formData.get("pricePerTonne")) : null;
  if (!projectName || tonnes <= 0) return;
  await db.carbonCredit.create({ data: { projectName, registry, vintage, tonnes, pricePerTonne } });
  revalidatePath("/environmental/credits");
  revalidatePath("/environmental");
}

export async function retireCredit(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id"));
  const c = await db.carbonCredit.findUnique({ where: { id } });
  if (!c || c.status === "RETIRED") return;
  await db.carbonCredit.update({ where: { id }, data: { status: "RETIRED", retiredAt: new Date() } });
  revalidatePath("/environmental/credits");
  revalidatePath("/environmental");
}

// ---------- Product ESG profiles ----------

export async function createProduct(formData: FormData) {
  await requireRole("ADMIN", "MANAGER");
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  const carbonPerUnit = Number(formData.get("carbonPerUnit") ?? 0);
  const recyclablePct = Number(formData.get("recyclablePct") ?? 0);
  const esgRating = String(formData.get("esgRating") ?? "B");
  const notes = String(formData.get("notes") ?? "") || null;
  if (!name || !sku) return;
  await db.productEsgProfile.create({
    data: { name, sku, carbonPerUnit, recyclablePct, esgRating, notes },
  });
  revalidatePath("/environmental/products");
}
