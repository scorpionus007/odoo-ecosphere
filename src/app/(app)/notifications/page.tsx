import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, Chip, EmptyState } from "@/components/ui";
import { revalidatePath } from "next/cache";
import Link from "next/link";

const toneByType: Record<string, string> = {
  COMPLIANCE_ISSUE: "red",
  APPROVAL: "green",
  POLICY_REMINDER: "amber",
  BADGE_UNLOCK: "violet",
  GENERAL: "gray",
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  async function markAllRead() {
    "use server";
    const u = await requireUser();
    await db.notification.updateMany({ where: { userId: u.id, read: false }, data: { read: true } });
    revalidatePath("/notifications");
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Compliance issues, approval decisions, policy reminders and badge unlocks"
        actions={
          <form action={markAllRead}>
            <button className="text-sm text-emerald-600 hover:underline cursor-pointer">
              Mark all read
            </button>
          </form>
        }
      />
      <Card>
        {items.length === 0 && <EmptyState message="Nothing here yet — go earn a badge 🌱" />}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "#"}
              className={`flex items-start gap-3 py-3 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg ${
                n.read ? "opacity-60" : ""
              }`}
            >
              <Chip label={n.type.replaceAll("_", " ")} tone={toneByType[n.type]} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{n.message}</div>
              </div>
              <div className="ml-auto text-[11px] text-slate-400 whitespace-nowrap">
                {n.createdAt.toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
