import { db } from "./db";
import { computeScores } from "./scoring";

export type ReportFilters = {
  module: "SUMMARY" | "ENVIRONMENTAL" | "SOCIAL" | "GOVERNANCE" | "GAMIFICATION";
  departmentId?: string;
  employeeId?: string;
  challengeId?: string;
  esgCategory?: "E" | "S" | "G" | "";
  dateFrom?: string;
  dateTo?: string;
};

export type Report = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

function dateWhere(f: ReportFilters) {
  const w: { gte?: Date; lte?: Date } = {};
  if (f.dateFrom) w.gte = new Date(f.dateFrom);
  if (f.dateTo) w.lte = new Date(new Date(f.dateTo).getTime() + 86399999);
  return Object.keys(w).length ? w : undefined;
}

export async function buildReport(f: ReportFilters): Promise<Report> {
  switch (f.module) {
    case "ENVIRONMENTAL": {
      const rows = await db.carbonTransaction.findMany({
        where: {
          departmentId: f.departmentId || undefined,
          date: dateWhere(f),
        },
        include: { department: true, emissionFactor: true },
        orderBy: { date: "desc" },
      });
      return {
        title: "Environmental Report — Carbon Transactions",
        columns: ["Date", "Source", "Emission Factor", "Department", "Quantity", "Unit", "kgCO2e", "Mode"],
        rows: rows.map((t) => [
          t.date.toISOString().slice(0, 10),
          t.source,
          t.emissionFactor.name,
          t.department.name,
          t.quantity,
          t.emissionFactor.unit,
          t.co2eKg,
          t.auto ? "AUTO" : "MANUAL",
        ]),
      };
    }
    case "SOCIAL": {
      const rows = await db.employeeParticipation.findMany({
        where: {
          employeeId: f.employeeId || undefined,
          employee: f.departmentId ? { departmentId: f.departmentId } : undefined,
          createdAt: dateWhere(f),
        },
        include: {
          employee: { include: { department: true } },
          activity: { include: { category: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Social Report — CSR Participation",
        columns: ["Employee", "Department", "Activity", "Category", "Status", "Points", "Volunteer Hours", "Completed"],
        rows: rows.map((p) => [
          p.employee.name,
          p.employee.department?.name ?? "—",
          p.activity.title,
          p.activity.category.name,
          p.approvalStatus,
          p.pointsEarned,
          p.hoursVolunteered,
          p.completionDate ? p.completionDate.toISOString().slice(0, 10) : "—",
        ]),
      };
    }
    case "GOVERNANCE": {
      const rows = await db.complianceIssue.findMany({
        where: {
          owner: f.departmentId ? { departmentId: f.departmentId } : undefined,
          ownerId: f.employeeId || undefined,
          createdAt: dateWhere(f),
        },
        include: { owner: { include: { department: true } }, audit: true },
        orderBy: { dueDate: "asc" },
      });
      const now = new Date();
      return {
        title: "Governance Report — Compliance Issues",
        columns: ["Issue", "Audit", "Severity", "Owner", "Department", "Due Date", "Status", "Overdue"],
        rows: rows.map((i) => [
          i.title,
          i.audit?.title ?? "—",
          i.severity,
          i.owner.name,
          i.owner.department?.name ?? "—",
          i.dueDate.toISOString().slice(0, 10),
          i.status,
          (i.status === "OPEN" || i.status === "IN_PROGRESS") && i.dueDate < now ? "YES" : "no",
        ]),
      };
    }
    case "GAMIFICATION": {
      const rows = await db.challengeParticipation.findMany({
        where: {
          employeeId: f.employeeId || undefined,
          challengeId: f.challengeId || undefined,
          employee: f.departmentId ? { departmentId: f.departmentId } : undefined,
          createdAt: dateWhere(f),
        },
        include: {
          employee: { include: { department: true } },
          challenge: { include: { category: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return {
        title: "Gamification Report — Challenge Participation",
        columns: ["Employee", "Department", "Challenge", "Category", "Difficulty", "Progress %", "Status", "XP Awarded"],
        rows: rows.map((p) => [
          p.employee.name,
          p.employee.department?.name ?? "—",
          p.challenge.title,
          p.challenge.category.name,
          p.challenge.difficulty,
          p.progress,
          p.approvalStatus,
          p.xpAwarded,
        ]),
      };
    }
    default: {
      const { departments, overall, weights } = await computeScores();
      const filtered = f.departmentId
        ? departments.filter((d) => d.departmentId === f.departmentId)
        : departments;
      const cat = f.esgCategory;
      const columns = ["Department", "Members", "CO2e (kg)"];
      if (!cat || cat === "E") columns.push("Environmental");
      if (!cat || cat === "S") columns.push("Social");
      if (!cat || cat === "G") columns.push("Governance");
      columns.push("Total Score");
      const rows: (string | number)[][] = filtered.map((d) => {
        const r: (string | number)[] = [d.name, d.members, Math.round(d.co2eKg)];
        if (!cat || cat === "E") r.push(d.envScore);
        if (!cat || cat === "S") r.push(d.socialScore);
        if (!cat || cat === "G") r.push(d.govScore);
        r.push(d.totalScore);
        return r;
      });
      rows.push([
        "OVERALL (weighted)",
        filtered.reduce((a, d) => a + d.members, 0),
        Math.round(filtered.reduce((a, d) => a + d.co2eKg, 0)),
        ...(!cat ? ["", "", ""] : [""]),
        overall,
      ]);
      return {
        title: `ESG Summary Report (weights E${weights.env}/S${weights.social}/G${weights.gov})`,
        columns,
        rows,
      };
    }
  }
}
