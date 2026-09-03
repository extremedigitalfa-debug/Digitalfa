// Seed PostgreSQL from the shared fictional dataset.
import { PrismaClient } from "@prisma/client";
import { seedDb } from "../seedDb.js";

const prisma = new PrismaClient();

async function main() {
  await seedDb(prisma);
  const counts = {
    companies: await prisma.company.count(),
    users: await prisma.user.count(),
    plans: await prisma.plan.count(),
    subscriptions: await prisma.subscription.count(),
    sources: await prisma.source.count(),
    jobs: await prisma.job.count(),
    progress: await prisma.progress.count(),
  };
  console.log("Seed completato:", JSON.stringify(counts));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
