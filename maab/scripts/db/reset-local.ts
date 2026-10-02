// يعيد بناء قاعدة محلية من الصفر: حذف المخططات، ثم الترحيل، ثم البذور.
// لا يعمل إلا على localhost حمايةً لأي قاعدة حقيقية.
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL غير مضبوط');
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) throw new Error(`رفض: ${host} ليس قاعدة محلية`);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe('drop schema if exists public cascade; drop schema if exists app cascade; drop schema if exists drizzle cascade; drop schema if exists pgboss cascade; create schema public;');
  await sql.end();
  const env = { ...process.env };
  execFileSync('npx', ['tsx', 'scripts/db/migrate.ts', '--local'], { stdio: 'inherit', env });
  execFileSync('npx', ['tsx', 'scripts/db/seed.ts', ...process.argv.slice(2)], { stdio: 'inherit', env });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
