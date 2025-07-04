import knex, { migrate, seed } from "#postgres/knex.js";
import { logger } from "#logger.js";
import { startCron } from "#cron.js";

await migrate.latest();
await seed.run();

logger.info("All migrations and seeds have been run");

startCron()