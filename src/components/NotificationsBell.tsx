"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationsBell({
  items,
  unread,
  markAllRead,
}: {
  items: NotificationItem[];
  unread: number;
  markAllRead: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button
                  className="text-xs text-emerald-600 hover:underline cursor-pointer"
                  onClick={async () => {
                    await markAllRead();
                    setOpen(false);
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {items.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-400">No notifications yet</div>
              )}
              {items.map((n) => (
                <Link
                  key={n.id}
                  href={n.link ?? "/notifications"}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                    n.read ? "opacity-60" : ""
                  }`}
                >
                  <div className="text-sm font-medium leading-snug">{n.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </Link>
              ))}
            </div>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-emerald-600 py-2.5 border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              View all
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
