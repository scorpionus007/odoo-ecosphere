/* eslint-disable @typescript-eslint/no-require-imports */
// Idempotent demo seed — safe to run on every container start.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const db = new PrismaClient();

async function main() {
  const already = await db.user.findUnique({ where: { email: "admin@ecosphere.io" } });
  if (already) {
    console.log("Seed: already seeded, skipping.");
    return;
  }
  console.log("Seed: creating demo data...");

  // ---- Departments ----
  const [ops, hr, it, fin, mkt, scm, lgl] = await Promise.all(
    [
      { name: "Operations", code: "OPS" },
      { name: "Human Resources", code: "HR" },
      { name: "IT & Engineering", code: "IT" },
      { name: "Finance", code: "FIN" },
      { name: "Marketing & Communications", code: "MKT" },
      { name: "Supply Chain & Logistics", code: "SCM" },
      { name: "Legal & Compliance", code: "LGL" },
    ].map((d) => db.department.create({ data: d }))
  );

  // ---- Users ----
  const pass = (p) => bcrypt.hashSync(p, 10);

  const firstNamesMale = [
    "Aarav", "Rohan", "Aditya", "Arjun", "Kabir", "Vivaan", "Vihaan", "Shaurya", "Atharva", "Ishan",
    "Krishna", "Vikram", "Raj", "Amit", "Sanjay", "Vijay", "Suresh", "Ramesh", "Sunil", "Anil",
    "Rahul", "Dev", "Alok", "Sameer", "Nikhil", "Pranav", "Ishaan", "Reyansh"
  ];
  const firstNamesFemale = [
    "Diya", "Priya", "Ananya", "Isha", "Kavya", "Sneha", "Riya", "Aaradhya", "Kiara", "Myra",
    "Nyra", "Saisha", "Meera", "Neha", "Pooja", "Sunita", "Anita", "Geeta", "Babita", "Rekha",
    "Shreya", "Nisha", "Aarti", "Tanvi", "Riddhi", "Siddhi", "Anjali"
  ];
  const lastNames = [
    "Sharma", "Patel", "Verma", "Iyer", "Rao", "Das", "Khan", "Kumar", "Singh", "Gupta",
    "Joshi", "Nair", "Reddy", "Mehta", "Trivedi", "Shah", "Kulkarni", "Deshmukh", "Bhat", "Patil",
    "Pillai", "Menon", "Sen", "Bose", "Choudhury", "Natarajan"
  ];

  function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generateUser(role, departmentId, departmentCode, index) {
    const isMale = Math.random() > 0.5;
    const firstName = isMale ? getRandomElement(firstNamesMale) : getRandomElement(firstNamesFemale);
    const lastName = getRandomElement(lastNames);
    const name = `${firstName} ${lastName}`;
    const email = `${role.toLowerCase()}.${departmentCode.toLowerCase()}.${index}@ecosphere.io`;
    const gender = isMale ? "MALE" : "FEMALE";
    return { name, email, gender, role, departmentId };
  }

  const admin = await db.user.create({
    data: { name: "Aarav Admin", email: "admin@ecosphere.io", password: pass("admin123"), role: "ADMIN", gender: "MALE", departmentId: it.id },
  });

  const allManagers = [];
  const employees = [];

  for (const dept of [ops, hr, it, fin, mkt, scm, lgl]) {
    // 3 managers per department
    for (let mIndex = 1; mIndex <= 3; mIndex++) {
      let mgr;
      if (dept.code === "OPS" && mIndex === 1) {
        mgr = await db.user.create({
          data: { name: "Meera Manager", email: "manager@ecosphere.io", password: pass("manager123"), role: "MANAGER", gender: "FEMALE", departmentId: dept.id },
        });
      } else {
        const u = generateUser("MANAGER", dept.id, dept.code, mIndex);
        mgr = await db.user.create({
          data: { ...u, password: pass("manager123") },
        });
      }
      allManagers.push(mgr);
    }

    // 12 employees per department
    for (let eIndex = 1; eIndex <= 12; eIndex++) {
      let emp;
      if (dept.code === "OPS" && eIndex === 1) {
        // stable demo account referenced by README/login page
        emp = await db.user.create({
          data: { name: "Priya Sharma", email: "priya@ecosphere.io", password: pass("employee123"), role: "EMPLOYEE", gender: "FEMALE", departmentId: dept.id },
        });
      } else {
        const u = generateUser("EMPLOYEE", dept.id, dept.code, eIndex);
        emp = await db.user.create({
          data: { ...u, password: pass("employee123") },
        });
      }
      employees.push(emp);
    }
  }

  const manager = allManagers.find((m) => m.email === "manager@ecosphere.io");

  // Set heads of departments
  for (const dept of [ops, hr, it, fin, mkt, scm, lgl]) {
    if (dept.id === it.id) {
      await db.department.update({ where: { id: dept.id }, data: { headId: admin.id } });
    } else {
      const firstDeptMgr = allManagers.find((m) => m.departmentId === dept.id);
      if (firstDeptMgr) {
        await db.department.update({ where: { id: dept.id }, data: { headId: firstDeptMgr.id } });
      }
    }
  }

  // ---- Categories ----
  const catTree = await db.category.create({ data: { name: "Tree Plantation", type: "CSR" } });
  const catDonate = await db.category.create({ data: { name: "Donation Drive", type: "CSR" } });
  const catVolunteer = await db.category.create({ data: { name: "Volunteering", type: "CSR" } });
  const catEnergy = await db.category.create({ data: { name: "Energy Saving", type: "CHALLENGE" } });
  const catCommute = await db.category.create({ data: { name: "Green Commute", type: "CHALLENGE" } });
  const catWaste = await db.category.create({ data: { name: "Zero Waste", type: "CHALLENGE" } });

  // ---- Emission factors ----
  const efElectricity = await db.emissionFactor.create({
    data: { name: "Grid Electricity", sourceModule: "MANUFACTURING", unit: "kWh", kgCo2ePerUnit: 0.82, scope: 2 },
  });
  const efDiesel = await db.emissionFactor.create({
    data: { name: "Diesel (Fleet)", sourceModule: "FLEET", unit: "litre", kgCo2ePerUnit: 2.68, scope: 1 },
  });
  const efPaper = await db.emissionFactor.create({
    data: { name: "Office Paper", sourceModule: "PURCHASE", unit: "kg", kgCo2ePerUnit: 1.3, scope: 3 },
  });
  const efTravel = await db.emissionFactor.create({
    data: { name: "Business Travel (Air)", sourceModule: "EXPENSE", unit: "km", kgCo2ePerUnit: 0.15, scope: 3 },
  });
  const efSteel = await db.emissionFactor.create({
    data: { name: "Steel Procurement", sourceModule: "PURCHASE", unit: "kg", kgCo2ePerUnit: 1.85, scope: 3 },
  });

  // ---- Operational records + auto carbon transactions ----
  const opsData = [
    ["MANUFACTURING", "Assembly line power draw — June", 12500, "kWh", efElectricity, ops.id, -30],
    ["FLEET", "Delivery van fuel — Route A", 420, "litre", efDiesel, ops.id, -25],
    ["PURCHASE", "Quarterly paper order", 180, "kg", efPaper, hr.id, -20],
    ["EXPENSE", "Client visit flights (BLR–DEL)", 3400, "km", efTravel, fin.id, -15],
    ["PURCHASE", "Steel brackets batch #88", 950, "kg", efSteel, it.id, -10],
    ["MANUFACTURING", "Server room power — June", 6100, "kWh", efElectricity, it.id, -8],
    ["FLEET", "Executive shuttle fuel", 150, "litre", efDiesel, fin.id, -5],
  ];
  for (const [type, description, quantity, unit, ef, departmentId, daysAgo] of opsData) {
    const date = new Date(Date.now() + daysAgo * 86400000);
    const rec = await db.operationalRecord.create({
      data: { type, description, quantity, unit, date, departmentId, emissionFactorId: ef.id },
    });
    await db.carbonTransaction.create({
      data: {
        operationalRecordId: rec.id,
        emissionFactorId: ef.id,
        departmentId,
        source: type,
        quantity,
        co2eKg: Math.round(quantity * ef.kgCo2ePerUnit * 100) / 100,
        auto: true,
        date,
      },
    });
  }

  // ---- Goals ----
  await db.environmentalGoal.create({
    data: {
      title: "Cut fleet emissions 20%",
      metric: "Fleet diesel CO2e",
      unit: "kgCO2e",
      baseline: 2000,
      target: 1600,
      currentValue: 1780,
      deadline: new Date(Date.now() + 90 * 86400000),
      departmentId: ops.id,
    },
  });
  await db.environmentalGoal.create({
    data: {
      title: "Renewable electricity 50%",
      metric: "Grid vs solar mix",
      unit: "%",
      baseline: 10,
      target: 50,
      currentValue: 28,
      deadline: new Date(Date.now() + 180 * 86400000),
    },
  });

  // ---- Product ESG profiles ----
  await db.productEsgProfile.createMany({
    data: [
      { name: "EcoBottle 500ml", sku: "ECO-500", carbonPerUnit: 0.4, recyclablePct: 95, esgRating: "A+" },
      { name: "Smart Sensor v2", sku: "SNS-002", carbonPerUnit: 2.1, recyclablePct: 60, esgRating: "B" },
      { name: "Legacy Charger", sku: "CHG-099", carbonPerUnit: 4.8, recyclablePct: 25, esgRating: "C" },
    ],
  });

  // ---- CSR activities + participations ----
  const plantation = await db.csrActivity.create({
    data: {
      title: "City Lake Tree Plantation",
      description: "Plant 500 saplings around the lake belt with the municipal team.",
      categoryId: catTree.id,
      date: new Date(Date.now() - 7 * 86400000),
      location: "Lakefront Park",
      pointsReward: 100,
      status: "COMPLETED",
      createdById: manager.id,
    },
  });
  const bloodDrive = await db.csrActivity.create({
    data: {
      title: "Annual Blood Donation Camp",
      description: "Partnered with Red Cross; on-site donation camp.",
      categoryId: catDonate.id,
      date: new Date(Date.now() + 10 * 86400000),
      location: "HQ Atrium",
      pointsReward: 80,
      status: "UPCOMING",
      createdById: manager.id,
    },
  });
  await db.csrActivity.create({
    data: {
      title: "Weekend Beach Cleanup",
      description: "Coastal cleanup with waste segregation training.",
      categoryId: catVolunteer.id,
      date: new Date(Date.now() + 20 * 86400000),
      location: "Marina Beach",
      pointsReward: 60,
      status: "UPCOMING",
      createdById: admin.id,
    },
  });
  // approved participations (award points)
  for (const emp of employees.slice(0, 4)) {
    await db.employeeParticipation.create({
      data: {
        employeeId: emp.id,
        activityId: plantation.id,
        approvalStatus: "APPROVED",
        pointsEarned: 100,
        proofUrl: null,
        completionDate: new Date(Date.now() - 6 * 86400000),
      },
    });
    await db.user.update({
      where: { id: emp.id },
      data: { xpTotal: { increment: 100 }, pointsBalance: { increment: 100 } },
    });
  }
  await db.employeeParticipation.create({
    data: { employeeId: employees[4].id, activityId: bloodDrive.id, approvalStatus: "PENDING" },
  });

  // ---- Training ----
  const courses = ["ESG Fundamentals", "Anti-Bribery & Ethics", "Workplace Safety"];
  for (const emp of employees) {
    for (const [i, courseTitle] of courses.entries()) {
      const done = (emp.name.length + i) % 3 !== 0;
      await db.trainingRecord.create({
        data: {
          employeeId: emp.id,
          courseTitle,
          status: done ? "COMPLETED" : "IN_PROGRESS",
          completedAt: done ? new Date(Date.now() - i * 5 * 86400000) : null,
        },
      });
    }
  }

  // ---- Challenges ----
  const cycleChallenge = await db.challenge.create({
    data: {
      title: "Cycle to Work Week",
      description: "Commute by cycle or public transport for 5 working days.",
      categoryId: catCommute.id,
      xp: 150,
      difficulty: "MEDIUM",
      evidenceRequired: true,
      deadline: new Date(Date.now() + 14 * 86400000),
      status: "ACTIVE",
    },
  });
  const paperless = await db.challenge.create({
    data: {
      title: "Paperless Sprint",
      description: "Zero printed pages for your team for 2 weeks.",
      categoryId: catWaste.id,
      xp: 100,
      difficulty: "EASY",
      evidenceRequired: false,
      deadline: new Date(Date.now() + 21 * 86400000),
      status: "ACTIVE",
    },
  });
  await db.challenge.create({
    data: {
      title: "Energy Saver Month",
      description: "Reduce your floor's power consumption by 10%.",
      categoryId: catEnergy.id,
      xp: 250,
      difficulty: "HARD",
      evidenceRequired: true,
      deadline: new Date(Date.now() + 30 * 86400000),
      status: "DRAFT",
    },
  });
  // one completed participation to power leaderboard/badges
  await db.challengeParticipation.create({
    data: {
      challengeId: paperless.id,
      employeeId: employees[0].id,
      progress: 100,
      approvalStatus: "APPROVED",
      xpAwarded: 100,
    },
  });
  await db.user.update({
    where: { id: employees[0].id },
    data: { xpTotal: { increment: 100 }, pointsBalance: { increment: 100 } },
  });
  await db.challengeParticipation.create({
    data: { challengeId: cycleChallenge.id, employeeId: employees[1].id, progress: 60, approvalStatus: "PENDING" },
  });

  // ---- Badges ----
  await db.badge.createMany({
    data: [
      { name: "Green Starter", description: "Earn your first 100 XP", icon: "🌱", ruleType: "XP", ruleThreshold: 100 },
      { name: "Eco Warrior", description: "Reach 250 XP", icon: "🛡️", ruleType: "XP", ruleThreshold: 250 },
      { name: "Challenge Champ", description: "Complete 3 challenges", icon: "🏆", ruleType: "CHALLENGES", ruleThreshold: 3 },
      { name: "Sustainability Legend", description: "Reach 1000 XP", icon: "👑", ruleType: "XP", ruleThreshold: 1000 },
    ],
  });
  // award Green Starter to those who crossed 100 XP
  const starters = await db.user.findMany({ where: { xpTotal: { gte: 100 } } });
  const greenStarter = await db.badge.findFirst({ where: { name: "Green Starter" } });
  for (const u of starters) {
    await db.userBadge.create({ data: { userId: u.id, badgeId: greenStarter.id } });
    await db.notification.create({
      data: {
        userId: u.id,
        type: "BADGE_UNLOCK",
        title: "Badge unlocked: Green Starter 🌱",
        message: "Earn your first 100 XP",
        link: "/gamification/badges",
      },
    });
  }

  // ---- Rewards ----
  await db.reward.createMany({
    data: [
      { name: "Reusable Coffee Kit", description: "Bamboo cup + steel straw set", type: "MERCH", pointsRequired: 150, stock: 20 },
      { name: "Extra Day Off", description: "One paid sustainability day", type: "PERK", pointsRequired: 500, stock: 5 },
      { name: "Plant a Tree (in your name)", description: "We plant, you track it", type: "DONATION", pointsRequired: 80, stock: 100 },
      { name: "EV Charging Credit", description: "₹1000 EV charging voucher", type: "GIFT_CARD", brand: "ChargeGrid", pointsRequired: 300, stock: 10 },
      { name: "Amazon Gift Card ₹500", description: "Digital voucher, instant claim code", type: "GIFT_CARD", brand: "Amazon", pointsRequired: 400, stock: 15 },
      { name: "Starbucks Card ₹300", description: "Coffee on the company — claim code", type: "GIFT_CARD", brand: "Starbucks", pointsRequired: 250, stock: 12 },
      { name: "Decathlon Voucher ₹1000", description: "Gear up for green commutes", type: "GIFT_CARD", brand: "Decathlon", pointsRequired: 700, stock: 6 },
    ],
  });

  // ---- Compliance standards library (ISO 14001 / SEBI BRSR / GRI) ----
  await db.complianceRequirement.createMany({
    data: [
      { standard: "ISO_14001", code: "4.3", title: "Scope of the EMS", description: "Determine boundaries and applicability of the environmental management system." },
      { standard: "ISO_14001", code: "5.2", title: "Environmental Policy", description: "Top management shall establish, implement and maintain an environmental policy." },
      { standard: "ISO_14001", code: "6.1.2", title: "Environmental Aspects", description: "Identify environmental aspects of activities, products and services and their impacts." },
      { standard: "ISO_14001", code: "7.2", title: "Competence & Training", description: "Ensure persons doing work are competent on the basis of education, training or experience." },
      { standard: "ISO_14001", code: "8.1", title: "Operational Planning & Control", description: "Establish, implement and control processes needed to meet EMS requirements." },
      { standard: "ISO_14001", code: "9.1", title: "Monitoring & Measurement", description: "Monitor, measure, analyse and evaluate environmental performance." },
      { standard: "ISO_14001", code: "10.2", title: "Nonconformity & Corrective Action", description: "React to nonconformities, take corrective action and review effectiveness." },
      { standard: "SEBI_BRSR", code: "P2", title: "Sustainable & Safe Goods", description: "Businesses should provide goods and services in a manner that is sustainable and safe." },
      { standard: "SEBI_BRSR", code: "P3", title: "Employee Well-being", description: "Businesses should respect and promote the well-being of all employees, including those in their value chains." },
      { standard: "SEBI_BRSR", code: "P6", title: "Environment Protection", description: "Businesses should respect and make efforts to protect and restore the environment." },
      { standard: "SEBI_BRSR", code: "P8", title: "Inclusive Growth", description: "Businesses should promote inclusive growth and equitable development." },
      { standard: "SEBI_BRSR", code: "P9", title: "Consumer Responsibility", description: "Businesses should engage with and provide value to their consumers in a responsible manner." },
      { standard: "GRI", code: "302", title: "Energy Disclosure", description: "Report energy consumption within the organization and energy intensity." },
      { standard: "GRI", code: "305", title: "Emissions Disclosure", description: "Report direct (Scope 1), indirect (Scope 2) and other (Scope 3) GHG emissions." },
      { standard: "GRI", code: "306", title: "Waste Disclosure", description: "Report waste generation, diversion and disposal by composition." },
    ],
  });

  // ---- Policies + acknowledgements ----
  const codePolicy = await db.esgPolicy.create({
    data: {
      title: "Code of Conduct",
      version: "3.1",
      category: "Ethics",
      content:
        "All employees must act with integrity, avoid conflicts of interest, and report violations through the whistleblower channel.",
    },
  });
  const envPolicy = await db.esgPolicy.create({
    data: {
      title: "Environmental Responsibility Policy",
      version: "2.0",
      category: "Environment",
      content:
        "Teams must segregate waste, prefer virtual meetings over travel, and procure from approved sustainable vendors.",
    },
  });
  // mark both policies Active and create acknowledgement records for everyone
  await db.esgPolicy.updateMany({ data: { status: "ACTIVE" } });
  const everyone = [admin, ...allManagers, ...employees];
  const ackedCode = new Set([...employees.slice(0, 3), manager, admin].map((u) => u.id));
  const ackedEnv = new Set(employees.slice(0, 2).map((u) => u.id));
  for (const u of everyone) {
    await db.policyAcknowledgement.create({
      data: {
        policyId: codePolicy.id,
        employeeId: u.id,
        status: ackedCode.has(u.id) ? "ACKNOWLEDGED" : "PENDING",
        acknowledgedAt: ackedCode.has(u.id) ? new Date() : null,
      },
    });
    await db.policyAcknowledgement.create({
      data: {
        policyId: envPolicy.id,
        employeeId: u.id,
        status: ackedEnv.has(u.id) ? "ACKNOWLEDGED" : "PENDING",
        acknowledgedAt: ackedEnv.has(u.id) ? new Date() : null,
      },
    });
  }

  // ---- Audits + compliance issues ----
  const audit = await db.audit.create({
    data: {
      title: "Q2 Internal ESG Audit",
      scope: "Operations & Fleet",
      departmentId: ops.id,
      auditorId: manager.id,
      status: "COMPLETED",
      findings: "Fleet logs incomplete for April; fuel receipts missing for 2 vehicles.",
      date: new Date(Date.now() - 12 * 86400000),
    },
  });
  await db.audit.create({
    data: {
      title: "Data Privacy Compliance Review",
      scope: "IT systems",
      departmentId: it.id,
      auditorId: admin.id,
      status: "IN_PROGRESS",
      date: new Date(Date.now() - 2 * 86400000),
    },
  });
  await db.complianceIssue.create({
    data: {
      auditId: audit.id,
      title: "Missing fleet fuel receipts",
      severity: "HIGH",
      description: "Two delivery vans lack fuel receipts for April — emissions understated.",
      ownerId: manager.id,
      dueDate: new Date(Date.now() - 3 * 86400000), // overdue on purpose (demo)
      status: "OPEN",
    },
  });
  await db.complianceIssue.create({
    data: {
      auditId: audit.id,
      title: "Waste segregation signage outdated",
      severity: "LOW",
      description: "Floor 2 pantry signage does not match new waste policy.",
      ownerId: employees[2].id,
      dueDate: new Date(Date.now() + 14 * 86400000),
      status: "IN_PROGRESS",
    },
  });
  await db.notification.create({
    data: {
      userId: manager.id,
      type: "COMPLIANCE_ISSUE",
      title: "Compliance issue assigned: Missing fleet fuel receipts",
      message: "Severity HIGH — due date passed, issue is overdue.",
      link: "/governance/issues",
    },
  });

  // ---- Carbon credits (offsets) ----
  await db.carbonCredit.createMany({
    data: [
      { projectName: "Rajasthan Solar Aggregation", registry: "VERRA", vintage: 2024, tonnes: 5, pricePerTonne: 850, status: "RETIRED", retiredAt: new Date() },
      { projectName: "Sundarbans Mangrove Restoration", registry: "GOLD_STANDARD", vintage: 2025, tonnes: 3, pricePerTonne: 1400, status: "PURCHASED" },
    ],
  });

  // ---- Grievance channel ----
  await db.grievance.create({
    data: {
      category: "SAFETY",
      description: "Fire exit on floor 2 is blocked by stored boxes near the pantry.",
      anonymous: true,
      status: "UNDER_REVIEW",
    },
  });

  console.log("Seed: done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
