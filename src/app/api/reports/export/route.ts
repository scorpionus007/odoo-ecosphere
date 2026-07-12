import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildReport, ReportFilters } from "@/lib/report";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  // non-admins can only export their own department's data — enforced server-side
  const pinnedDept =
    session.role === "ADMIN" ? sp.get("departmentId") || undefined : session.departmentId ?? "none";
  const filters: ReportFilters = {
    module: (sp.get("module") as ReportFilters["module"]) || "SUMMARY",
    departmentId: pinnedDept,
    employeeId: sp.get("employeeId") || undefined,
    challengeId: sp.get("challengeId") || undefined,
    esgCategory: (sp.get("esgCategory") as ReportFilters["esgCategory"]) || "",
    dateFrom: sp.get("dateFrom") || undefined,
    dateTo: sp.get("dateTo") || undefined,
  };
  const format = sp.get("format") ?? "csv";
  const report = await buildReport(filters);
  const base = `ecosphere-${filters.module.toLowerCase()}-report`;

  if (format === "csv") {
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    };
    const csv = [report.columns.map(esc).join(","), ...report.rows.map((r) => r.map(esc).join(","))].join("\n");
    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Report");
    ws.addRow([report.title]);
    ws.getRow(1).font = { bold: true, size: 14 };
    ws.addRow([]);
    const header = ws.addRow(report.columns);
    header.font = { bold: true };
    header.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
      c.border = { bottom: { style: "thin" } };
    });
    for (const r of report.rows) ws.addRow(r);
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: false }, (c) => {
        max = Math.max(max, String(c.value ?? "").length + 2);
      });
      col.width = Math.min(max, 42);
    });
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      },
    });
  }

  // PDF
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: report.columns.length > 6 ? "landscape" : "portrait" });
  doc.setFontSize(14);
  doc.text(report.title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()} · EcoSphere ESG Platform`, 14, 22);
  autoTable(doc, {
    head: [report.columns],
    body: report.rows.map((r) => r.map(String)),
    startY: 27,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] },
  });
  const pdf = doc.output("arraybuffer");
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${base}.pdf"`,
    },
  });
}
