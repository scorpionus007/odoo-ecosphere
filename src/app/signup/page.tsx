import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { Leaf } from "lucide-react";
import { btnPrimary, inputCls } from "@/components/ui";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const departments = await db.department.findMany({ where: { status: "ACTIVE" } });

  async function signup(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").toLowerCase().trim();
    const password = String(formData.get("password") ?? "");
    const gender = String(formData.get("gender") ?? "") || null;
    const departmentId = String(formData.get("departmentId") ?? "") || null;
    if (!name || !email || password.length < 6) {
      redirect("/signup?error=Fill+all+fields+(password+min+6+chars)");
    }
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) redirect("/signup?error=Email+already+registered");
    // Signup always creates an Employee — roles are elevated by Admin only
    const user = await db.user.create({
      data: { name, email, password: await bcrypt.hash(password, 10), gender, departmentId, role: "EMPLOYEE" },
    });
    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: "EMPLOYEE",
      departmentId: user.departmentId,
    });
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 font-bold text-lg mb-8">
          <div className="h-9 w-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
            <Leaf size={18} />
          </div>
          EcoSphere
        </div>
        <h2 className="text-2xl font-bold">Create your account</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">Join as an employee and start earning XP</p>
        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-4 py-2.5">
            {error}
          </div>
        )}
        <form action={signup} className="space-y-4">
          <input name="name" required placeholder="Full name" className={inputCls} />
          <input name="email" type="email" required placeholder="Work email" className={inputCls} />
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="Password (min 6 chars)"
            className={inputCls}
          />
          <select name="gender" className={inputCls} defaultValue="">
            <option value="">Gender (optional — diversity metrics)</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
          <select name="departmentId" className={inputCls} defaultValue="">
            <option value="">Department (optional)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button className={`${btnPrimary} w-full justify-center`}>Create account</button>
        </form>
        <p className="text-sm text-slate-500 mt-5">
          Already registered?{" "}
          <Link href="/login" className="text-emerald-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
