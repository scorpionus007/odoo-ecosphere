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
- **Gamification** — challenge lifecycle (Draft → Active → Under Review →
  Completed / Archived), XP, auto-awarded badges, reward redemption with stock,
  leaderboards
- **Scoring** — department E/S/G scores rolled into a configurable weighted
  overall ESG score (default 40/30/30)
- **Reports** — Environmental / Social / Governance / ESG Summary + custom
  report builder with 6 filters, exported as PDF / Excel / CSV
- **Notifications** — in-app alerts for compliance issues, approval decisions,
  policy reminders and badge unlocks (configurable in Settings)

## Stack

Next.js (App Router) · TypeScript · PostgreSQL · Prisma · Tailwind CSS · Recharts
