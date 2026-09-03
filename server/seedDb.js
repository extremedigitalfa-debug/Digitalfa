// Reusable seeding logic — used by prisma/seed.js and the admin reset endpoint.
import bcrypt from "bcryptjs";
import { buildSeed } from "./data.js";
import { dedupKey } from "./scheduler.js";

const cardFields = (card) => (card ? { cardBrand: card.brand, cardLast4: card.last4, cardExpMonth: card.expMonth, cardExpYear: card.expYear } : {});

export async function seedDb(prisma) {
  const s = buildSeed();

  await prisma.scanLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.application.deleteMany();
  await prisma.progress.deleteMany();
  await prisma.job.deleteMany();
  await prisma.source.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.program.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  await prisma.company.createMany({ data: s.companies });
  await prisma.program.createMany({ data: s.programs });
  await prisma.plan.createMany({ data: s.plans });
  await prisma.resource.createMany({ data: s.resources });

  const nonCand = s.users.filter((u) => u.role !== "candidate");
  const cand = s.users.filter((u) => u.role === "candidate");
  for (const u of [...nonCand, ...cand]) {
    await prisma.user.create({ data: { ...u, password: bcrypt.hashSync(u.password, 10), authProvider: "password" } });
  }

  // Scheduler settings (singleton)
  await prisma.setting.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton", schedulerEnabled: true, checkIntervalSec: 60 } });

  for (const [userId, obj] of Object.entries(s.progress))
    for (const [key, status] of Object.entries(obj))
      await prisma.progress.create({ data: { userId, key, status } });

  for (const sub of s.subscriptions) {
    const { card, ...rest } = sub;
    await prisma.subscription.create({ data: { ...rest, ...cardFields(card) } });
  }

  await prisma.source.createMany({ data: s.sources });
  await prisma.job.createMany({ data: s.jobs.map((j) => ({ ...j, dedupKey: dedupKey(j.title, j.company) })) });
  await prisma.application.createMany({ data: s.applications });
  await prisma.session.createMany({ data: s.sessions });
  await prisma.scanLog.createMany({ data: s.scanLogs });
}
