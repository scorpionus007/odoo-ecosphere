import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { Leaf } from "lucide-react";
import { btnPrimary, inputCls } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").toLowerCase().trim();
    const password = String(formData.get("password") ?? "");
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      redirect("/login?error=Invalid+email+or+password");
    }
    if (user.status !== "ACTIVE") redirect("/login?error=Account+is+inactive");
    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as "ADMIN" | "MANAGER" | "EMPLOYEE",
      departmentId: user.departmentId,
    });
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 text-white p-10">
        <div className="flex items-center gap-2 font-bold text-lg">
          <div className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center">
            <Leaf size={18} />
          </div>
          EcoSphere
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight max-w-md">
            ESG built into your day-to-day operations.
          </h1>
          <p className="mt-4 text-emerald-100/90 max-w-md text-sm leading-relaxed">
            Carbon accounting, CSR participation, governance compliance and gamified
            sustainability — measured in real time on one unified dashboard.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md text-center">
            {[
              ["E", "Carbon & goals"],
              ["S", "CSR & people"],
              ["G", "Policy & audits"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/10 p-3">
                <div className="text-2xl font-bold">{k}</div>
                <div className="text-[11px] text-emerald-100/80">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-emerald-100/60">Hackathon build · 2026</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 font-bold text-lg mb-8">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Leaf size={18} />
            </div>
            EcoSphere
          </div>
          <h2 className="text-2xl font-bold">Welcome back</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">Sign in to your workspace</p>
          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-4 py-2.5">
              {error}
            </div>
          )}
          <form action={login} className="space-y-4">
            <input name="email" type="email" required placeholder="Email" className={inputCls} />
            <input name="password" type="password" required placeholder="Password" className={inputCls} />
            <button className={`${btnPrimary} w-full justify-center`}>Sign in</button>
          </form>
          <p className="text-sm text-slate-500 mt-5">
            New employee?{" "}
            <Link href="/signup" className="text-emerald-600 font-medium hover:underline">
              Create an account
            </Link>
          </p>
          <div className="mt-6 rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500 space-y-1">
            <div className="font-semibold text-slate-600 dark:text-slate-300">Demo accounts</div>
            <div>admin@ecosphere.io · admin123 (Admin)</div>
            <div>manager@ecosphere.io · manager123 (Manager)</div>
            <div>priya@ecosphere.io · employee123 (Employee)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
