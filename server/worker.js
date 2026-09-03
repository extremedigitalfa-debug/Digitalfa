// Standalone scheduler worker — run as a separate process/dyno in production
// (e.g. a Render "Background Worker"). Cooperates with web instances via the
// Postgres advisory lock in scheduler.js, so no source is scanned twice.
//
//   node worker.js   (or: npm run worker)

import { PrismaClient } from "@prisma/client";
import { startTicker } from "./scheduler.js";

const prisma = new PrismaClient();
const getSettings = async () =>
  (await prisma.setting.findUnique({ where: { id: "singleton" } })) ||
  (await prisma.setting.create({ data: { id: "singleton" } }));

console.log("[worker] scheduler worker avviato");
const stop = startTicker(prisma, getSettings);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => { stop(); await prisma.$disconnect(); process.exit(0); });
}
