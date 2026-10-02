// تطبيق ملفات الترحيل: npm run db:migrate
// على Postgres محلي تُطبَّق أولاً طبقة Supabase المحاكية (db/local/supabase-shim.sql).
import { readFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL غير مضبوط');
const local = process.argv.includes('--local') || process.env.DB_LOCAL_SHIM === '1';

async function main(dbUrl: string) {
  const client = postgres(dbUrl, { max: 1, onnotice: () => {} });
  try {
    if (local) {
      await client.unsafe(readFileSync('db/local/supabase-shim.sql', 'utf8'));
      console.log('✓ طبقة Supabase المحلية');
    }
    await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
    console.log('✓ الترحيل');
  } finally {
    await client.end();
  }
}

main(url).catch((e) => {
  console.error(e);
  process.exit(1);
});
