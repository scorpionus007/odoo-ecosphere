import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationsBell from "@/components/NotificationsBell";
import { currentUser, destroySession, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { LogOut, Sparkles } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await currentUser();
  if (!user) redirect("/login");

  const [notifications, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  async function markAllRead() {
    "use server";
    const s = await getSession();
    if (!s) return;
    await db.notification.updateMany({ where: { userId: s.id, read: false }, data: { read: true } });
    revalidatePath("/", "layout");
  }

  async function logout() {
    "use server";
    await destroySession();
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Sidebar role={user.role} />
      <div className="lg:pl-60 flex flex-col min-h-screen">
        <header className="no-print sticky top-0 z-30 h-14 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur flex items-center justify-between px-4 lg:px-6 gap-3">
          <div className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
            {user.department ? `${user.department.name} · ` : ""}
            <span className="capitalize">{user.role.toLowerCase()}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div
              className="hidden sm:flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 px-3 py-1 text-xs font-semibold"
              title="Redeemable points balance"
            >
              <Sparkles size={12} /> {user.pointsBalance} pts
            </div>
            <NotificationsBell
              items={notifications.map((n) => ({
                id: n.id,
                title: n.title,
                message: n.message,
                link: n.link,
                read: n.read,
                createdAt: n.createdAt.toISOString(),
              }))}
              unread={unread}
              markAllRead={markAllRead}
            />
            <ThemeToggle />
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <div className="h-8 w-8 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="hidden md:block leading-tight">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-[10px] text-slate-400">{user.email}</div>
              </div>
              <form action={logout}>
                <button
                  className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Sign out"
                >
                  <LogOut size={15} />
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
        <footer className="no-print text-center text-xs text-slate-400 pb-4">
          EcoSphere · ESG Management Platform ·{" "}
          <Link href="/reports" className="hover:underline">
            Reports
          </Link>
        </footer>
      </div>
    </div>
  );
}
