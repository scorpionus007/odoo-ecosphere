import { db } from "./db";
import { getSettings } from "./settings";

type NotifyType = "COMPLIANCE_ISSUE" | "APPROVAL" | "POLICY_REMINDER" | "BADGE_UNLOCK" | "GENERAL";

const SETTING_KEY: Record<NotifyType, keyof Awaited<ReturnType<typeof getSettings>>["notifications"] | null> = {
  COMPLIANCE_ISSUE: "complianceIssue",
  APPROVAL: "approvals",
  POLICY_REMINDER: "policyReminders",
  BADGE_UNLOCK: "badgeUnlocks",
  GENERAL: null,
};

export async function notify(
  userId: string,
  type: NotifyType,
  title: string,
  message: string,
  link?: string
) {
  const settings = await getSettings();
  const key = SETTING_KEY[type];
  if (key && !settings.notifications[key]) return; // channel disabled in Notification Settings
  await db.notification.create({ data: { userId, type, title, message, link } });
}

export async function notifyMany(userIds: string[], type: NotifyType, title: string, message: string, link?: string) {
  for (const id of userIds) await notify(id, type, title, message, link);
}
