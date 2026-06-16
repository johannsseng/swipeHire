import { prisma } from "./db.js";

// Stale-job pruning — keeps the feed fresh by retiring listings that have aged
// out. A job's `updatedAt` is bumped every time a sync re-sees it on its source
// board, so any *active* job that hasn't been refreshed in JOB_STALE_DAYS is
// almost certainly filled or delisted. We deactivate (active=false) rather than
// hard-delete, so anyone who already saved the job keeps it in their list — it
// just stops appearing in Discover.
//
// Run AFTER a sync so live jobs are freshly stamped first:
//   pnpm sync && pnpm prune          (locally)
//   chained in the nightly cron      (production)

const STALE_DAYS = Number(process.env["JOB_STALE_DAYS"] ?? "60");

async function main() {
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.job.updateMany({
    where: { active: true, updatedAt: { lt: cutoff } },
    data: { active: false },
  });

  const remaining = await prisma.job.count({ where: { active: true } });
  console.log(
    `Retired ${result.count} stale job(s) not refreshed in ${STALE_DAYS} days. ` +
      `${remaining} active listings remain.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
