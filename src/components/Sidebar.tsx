"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Leaf, Factory, Target, FlaskConical, Package, HeartHandshake,
  Users, GraduationCap, Scale, FileCheck2, ShieldAlert, ClipboardCheck, Trophy,
  Gamepad2, FileBarChart2, Settings, Menu, X, Globe2,
} from "lucide-react";
import { useState } from "react";

type Item = { href: string; label: string; icon: React.ReactNode; roles?: string[] };
type Group = { title: string; items: Item[] };

const NAV: Group[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "ESG Dashboard", icon: <LayoutDashboard size={16} /> },
      { href: "/quest", label: "EcoQuest World", icon: <Gamepad2 size={16} /> },
      { href: "/reports", label: "Reports", icon: <FileBarChart2 size={16} /> },
    ],
  },
  {
    title: "Environmental",
    items: [
      { href: "/environmental", label: "Env. Dashboard", icon: <Leaf size={16} /> },
      { href: "/environmental/operations", label: "Operations", icon: <Factory size={16} /> },
      { href: "/environmental/transactions", label: "Carbon Transactions", icon: <FlaskConical size={16} /> },
      { href: "/environmental/factors", label: "Emission Factors", icon: <Globe2 size={16} />, roles: ["ADMIN", "MANAGER"] },
      { href: "/environmental/goals", label: "Goals", icon: <Target size={16} /> },
      { href: "/environmental/products", label: "Product Profiles", icon: <Package size={16} />, roles: ["ADMIN", "MANAGER"] },
    ],
  },
  {
    title: "Social",
    items: [
      { href: "/social", label: "CSR Activities", icon: <HeartHandshake size={16} /> },
      { href: "/social/diversity", label: "Diversity Metrics", icon: <Users size={16} /> },
      { href: "/social/training", label: "Training", icon: <GraduationCap size={16} /> },
    ],
  },
  {
    title: "Governance",
    items: [
      { href: "/governance/policies", label: "ESG Policies", icon: <Scale size={16} /> },
      { href: "/governance/audits", label: "Audits", icon: <FileCheck2 size={16} /> },
      { href: "/governance/issues", label: "Compliance Issues", icon: <ShieldAlert size={16} /> },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/approvals", label: "Approvals", icon: <ClipboardCheck size={16} />, roles: ["ADMIN", "MANAGER"] },
      { href: "/gamification/challenges", label: "Quest Studio", icon: <Trophy size={16} />, roles: ["ADMIN", "MANAGER"] },
      { href: "/settings", label: "Settings", icon: <Settings size={16} />, roles: ["ADMIN"] },
    ],
  },
];

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-5">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.roles || i.roles.includes(role));
        if (!items.length) return null;
        return (
          <div key={group.title}>
            <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active =
                  item.href === pathname ||
                  (item.href !== "/dashboard" && item.href.split("/").length > 2 && pathname === item.href) ||
                  (pathname.startsWith(item.href + "/") && item.href !== "/environmental" && item.href !== "/social");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                      active || pathname === item.href
                        ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 font-medium"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* mobile toggle */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center no-print"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-60 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
            E
          </div>
          <div>
            <div className="font-bold leading-tight">EcoSphere</div>
            <div className="text-[10px] text-slate-400 -mt-0.5 tracking-wide">ESG MANAGEMENT</div>
          </div>
        </div>
        {nav}
      </aside>
    </>
  );
}
