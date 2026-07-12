# EcoSphere — ESG Management Platform

Measure, manage and improve **Environmental, Social and Governance** performance:
carbon accounting, CSR participation, governance compliance and gamified
sustainability on one unified dashboard.

## 🚀 Quick start

Prereqs: Node 20+, a PostgreSQL database (any of: local install, one-liner
container, or a free cloud DB like Neon/Supabase).

```bash
# 1. get a Postgres (skip if you already have one)
docker run -d --name ecosphere-db -e POSTGRES_USER=ecosphere -e POSTGRES_PASSWORD=ecosphere -e POSTGRES_DB=ecosphere -p 5432:5432 postgres:16-alpine

# 2. configure + run
cp .env.example .env          # adjust DATABASE_URL if your postgres differs
npm install
npm run setup                 # pushes schema + seeds demo data
npm run dev
```

Need a pristine demo state again? `npm run db:reset` wipes and re-seeds.

Open **http://localhost:3000**.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@ecosphere.io | admin123 |
| Manager | manager@ecosphere.io | manager123 |
| Employee | priya@ecosphere.io | employee123 |

## Modules

- **Environmental** — emission factor configuration, operational data
  (Purchase / Manufacturing / Expense / Fleet), automatic carbon transaction
  calculation, department carbon tracking, sustainability goals, environmental dashboard
- **Social** — CSR activities, employee participation with proof + approval,
  diversity metrics, training completion
- **Governance** — ESG policies + acknowledgements, audits, compliance issues
  with mandatory owner/due date and overdue flagging
- **EcoQuest World (first-person 3D)** — gamification is a playable 3D
  eco-village (three.js). Pick a **boy or girl avatar**, then explore in
  **first person** (with visible swinging arms) or press **C** for a
  third-person view of your fully-animated character (walking legs, arms, feet).
  **Controls:** ↑↓ / W,S walk · ←→ / A,D turn · **Shift** run · **Space** jump ·
  **E / Enter** interact when you walk up to a building · **C** toggle camera.
  A **minimap** (top-right) shows every station around the village circle with
  your live position. Walk up to Village Hall, Bike Dock, Solar Farm, Recycle
  Hub, Trading Post and Hall of Fame to accept quests, submit proof, claim
  gift cards and view the leaderboard. XP levels, animated HUD, badge
  auto-awards, a first-time interactive tutorial (replay with the ? button),
  and village fog driven by your live ESG score — quest well and the smog lifts.
  Gift-card rewards (Amazon / Starbucks / Decathlon) mint instant claim codes.
  Managers run the challenge lifecycle from the Quest Studio.
- **Department-scoped RBAC** — Admins see the whole organization. Managers and
  Employees are locked to their own department everywhere: dashboards,
  environmental data, diversity, training, approvals, reports and even export
  APIs (server-side enforced). Managers can only approve, assign and manage
  people inside their department.
- **Scoring** — department E/S/G scores rolled into a configurable weighted
  overall ESG score (default 40/30/30)
- **Reports** — Environmental / Social / Governance / ESG Summary + custom
  report builder with 6 filters, exported as PDF / Excel / CSV
- **Notifications** — in-app alerts for compliance issues, approval decisions,
  policy reminders and badge unlocks (configurable in Settings)

## Verified business rules

Every §8 core rule from the problem statement is enforced and was tested end-to-end:

- ✅ **Auto Emission Calculation** — recording a 100 L diesel fleet operation auto-creates a 268 kg CO₂e carbon transaction (100 × 2.68 factor)
- ✅ **Evidence Requirement** — the Approve button on the Approvals queue is disabled for any CSR/challenge submission without an attached proof file while the toggle is ON
- ✅ **Badge Auto-Award** — crossing an XP threshold instantly grants the badge (e.g. 260 XP unlocked "Eco Warrior" at the 250-XP rule) and fires a notification
- ✅ **Reward Redemption** — deducts points (200 → 120 on an 80-pt reward), decrements stock, records the redemption, blocks unaffordable/out-of-stock items
- ✅ **Compliance Issue Ownership** — owner + due date are mandatory; overdue open issues are highlighted and can notify owners in bulk
- ✅ **Notification System** — approval decisions, badge unlocks, policy reminders and compliance issues, each channel toggleable in Settings

## 3-minute demo script

1. Sign in as **admin** → ESG Dashboard: overall weighted score, department rankings, emission trends
2. Environmental → Operations: record a Fleet operation with the Diesel factor → watch the CO₂e appear automatically
3. Sign in as **priya** (employee): pick an avatar, then the tutorial opens **EcoQuest World** — walk (↑↓←→, Space to jump) up to the Village Hall, press **E** to join a CSR event and attach a proof photo, then walk to the Trading Post and buy an Amazon gift card → copy the instant claim code. Note her dashboard/reports only show *Operations* data.
4. Sign in as **manager** (Meera, Operations): Approvals shows *only her department's* submissions → approve Priya → her XP jumps, the HUD levels up, a badge auto-awards and the village smog thins
5. Reports → Custom builder: filter + export the same report as PDF, Excel and CSV (non-admins are server-side locked to their department, even via the API)
6. Settings: flip the three business-rule toggles and the E/S/G weights live

## Stack

Next.js (App Router) · TypeScript · PostgreSQL · Prisma · Tailwind CSS · Recharts
