// عامل الخلفية: npm run worker. يعمل منفصلاً عن خادم الويب على قاعدة البيانات
// نفسها، ويجدول المهام بـpg-boss (مخطط pgboss) فتعمل مرة واحدة حتى مع عدة نسخ.
import { PgBoss } from 'pg-boss';
import { closeDb, databaseUrl } from '../server/db/client';
import { JOBS } from '../server/jobs';

async function main() {
  const boss = new PgBoss({ connectionString: databaseUrl(), schema: 'pgboss' });
  boss.on('error', (e) => console.error('[worker]', e));
  await boss.start();

  for (const [name, job] of Object.entries(JOBS)) {
    await boss.createQueue(name);
    // جدولة UTC؛ المهام نفسها تراعي منطقة كل مستخدم
    await boss.schedule(name, job.cron, null, { tz: 'UTC' });
    await boss.work(name, async () => {
      const started = Date.now();
      const result = await job.run();
      console.info(`[worker] ${name} ${Date.now() - started}ms`, JSON.stringify(result));
      return result;
    });
  }
  console.info(`[worker] يعمل: ${Object.keys(JOBS).join('، ')}`);

  const stop = async () => {
    await boss.stop({ graceful: true, timeout: 20_000 });
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
