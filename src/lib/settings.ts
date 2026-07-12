import { db } from "./db";

export type EsgSettings = {
  weights: { env: number; social: number; gov: number };
  autoEmissionCalc: boolean;
  evidenceRequirement: boolean;
  badgeAutoAward: boolean;
  notifications: {
    complianceIssue: boolean;
    approvals: boolean;
    policyReminders: boolean;
    badgeUnlocks: boolean;
    email: boolean; // email channel toggle (in-app always available)
  };
};

export const DEFAULT_SETTINGS: EsgSettings = {
  weights: { env: 40, social: 30, gov: 30 },
  autoEmissionCalc: true,
  evidenceRequirement: true,
  badgeAutoAward: true,
  notifications: {
    complianceIssue: true,
    approvals: true,
    policyReminders: true,
    badgeUnlocks: true,
    email: false,
  },
};

export async function getSettings(): Promise<EsgSettings> {
  const row = await db.appSetting.findUnique({ where: { key: "esg" } });
  if (!row) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
}

export async function saveSettings(s: EsgSettings) {
  await db.appSetting.upsert({
    where: { key: "esg" },
    create: { key: "esg", value: JSON.stringify(s) },
    update: { value: JSON.stringify(s) },
  });
}
