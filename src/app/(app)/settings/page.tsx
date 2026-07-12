import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader, Card, Field, inputCls, btnPrimary, Chip } from "@/components/ui";
import { saveEsgConfig, saveNotificationSettings, setUserRole } from "./actions";
import { Building2, Tags } from "lucide-react";

export const dynamic = "force-dynamic";

function Toggle({ name, label, checked, hint }: { name: string; label: string; checked: boolean; hint: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-1 h-4 w-4 accent-emerald-600" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-slate-400">{hint}</span>
      </span>
    </label>
  );
}

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const [settings, users] = await Promise.all([
    getSettings(),
    db.user.findMany({ include: { department: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Settings & Administration" subtitle="ESG configuration, business-rule toggles and roles" />

      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <Link href="/settings/departments">
          <Card className="hover:border-emerald-400 transition-colors">
            <div className="flex items-center gap-3">
              <Building2 className="text-emerald-600" size={20} />
              <div>
                <div className="font-semibold text-sm">Departments</div>
                <div className="text-xs text-slate-400">Hierarchy, heads and ESG ownership</div>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/settings/categories">
          <Card className="hover:border-emerald-400 transition-colors">
            <div className="flex items-center gap-3">
              <Tags className="text-emerald-600" size={20} />
              <div>
                <div className="font-semibold text-sm">Categories</div>
                <div className="text-xs text-slate-400">Shared CSR & Challenge category values</div>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card title="ESG Configuration">
          <form action={saveEsgConfig} className="space-y-4">
            <div>
              <div className="text-xs font-medium text-slate-500 mb-2">
                Overall score weighting (%) — default 40 / 30 / 30
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Environmental">
                  <input name="wEnv" type="number" min="0" max="100" defaultValue={settings.weights.env} className={inputCls} />
                </Field>
                <Field label="Social">
                  <input name="wSocial" type="number" min="0" max="100" defaultValue={settings.weights.social} className={inputCls} />
                </Field>
                <Field label="Governance">
                  <input name="wGov" type="number" min="0" max="100" defaultValue={settings.weights.gov} className={inputCls} />
                </Field>
              </div>
            </div>
            <div className="space-y-3 pt-1">
              <Toggle
                name="autoEmissionCalc"
                label="Auto Emission Calculation"
                checked={settings.autoEmissionCalc}
                hint="Carbon transactions are calculated automatically from linked Purchase/Manufacturing/Expense/Fleet records"
              />
              <Toggle
                name="evidenceRequirement"
                label="Evidence Requirement"
                checked={settings.evidenceRequirement}
                hint="CSR participation cannot be Approved without an attached proof file"
              />
              <Toggle
                name="badgeAutoAward"
                label="Badge Auto-Award"
                checked={settings.badgeAutoAward}
                hint="Badges are assigned the moment XP / completed challenges satisfy the unlock rule"
              />
            </div>
            <button className={btnPrimary}>Save configuration</button>
          </form>
        </Card>

        <Card title="Notification Settings">
          <form action={saveNotificationSettings} className="space-y-3">
            <Toggle name="complianceIssue" label="Compliance issues" checked={settings.notifications.complianceIssue} hint="New compliance issue raised / overdue" />
            <Toggle name="approvals" label="Approval decisions" checked={settings.notifications.approvals} hint="CSR & Challenge approval/rejection results" />
            <Toggle name="policyReminders" label="Policy acknowledgement reminders" checked={settings.notifications.policyReminders} hint="Nudges for unacknowledged policies" />
            <Toggle name="badgeUnlocks" label="Badge unlocks" checked={settings.notifications.badgeUnlocks} hint="When a badge is auto-awarded" />
            <Toggle name="email" label="Email channel" checked={settings.notifications.email} hint="Send email in addition to in-app (demo: logged only)" />
            <button className={btnPrimary}>Save notification settings</button>
          </form>
        </Card>
      </div>

      <Card title="Users & roles">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">XP</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Change role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 pr-4">
                    <div className="text-sm font-medium">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-sm">{u.department?.name ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-sm">{u.xpTotal}</td>
                  <td className="py-2.5 pr-4">
                    <Chip label={u.role} tone={u.role === "ADMIN" ? "violet" : u.role === "MANAGER" ? "blue" : "gray"} />
                  </td>
                  <td className="py-2.5 pr-4">
                    <form action={setUserRole} className="flex gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <select name="role" defaultValue={u.role} className={`${inputCls} !w-auto`}>
                        <option value="EMPLOYEE">Employee</option>
                        <option value="MANAGER">Manager</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <button className="text-sm text-emerald-600 hover:underline cursor-pointer">Apply</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
