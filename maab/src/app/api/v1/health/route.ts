import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ data: { ok: true, db: 'up' } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ code: 'db_down', message_ar: 'قاعدة البيانات لا تستجيب', details: null }, { status: 503 });
  }
}
