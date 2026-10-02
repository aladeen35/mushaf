// اتصال قاعدة البيانات. كل طلب مستخدم يجري داخل معاملة بدور authenticated
// وهويته في request.jwt.claims فتنطبق سياسات RLS (الطبقة الثالثة للصلاحية)،
// والعمليات المركّبة بدور service_role بعد فحص الصلاحية في الخادم.
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

const globalForDb = globalThis as unknown as { maabSql?: ReturnType<typeof postgres>; maabDb?: DB };

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL غير مضبوط');
  return url;
}

/** اتصال واحد مشترك (يُعاد استعماله بين إعادة التحميل في التطوير) */
export function getDb(): DB {
  if (!globalForDb.maabDb) {
    // prepare:false يناسب مجمّع اتصالات Supabase في وضع المعاملات
    globalForDb.maabSql = postgres(databaseUrl(), { max: Number(process.env.DB_POOL_MAX ?? 10), prepare: false });
    globalForDb.maabDb = drizzle(globalForDb.maabSql, { schema, casing: 'snake_case' });
  }
  return globalForDb.maabDb;
}

export async function closeDb() {
  await globalForDb.maabSql?.end({ timeout: 5 });
  globalForDb.maabSql = undefined;
  globalForDb.maabDb = undefined;
}

async function setIdentity(tx: Tx, role: 'anon' | 'authenticated' | 'service_role', sub: string | null) {
  const claims = JSON.stringify(sub ? { sub, role } : { role });
  await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
  await tx.execute(sql.raw(`set local role ${role}`));
}

/** معاملة بهوية المستخدم: كل ما فيها يخضع لسياسات RLS */
export function asUser<T>(userId: string, fn: (tx: Tx) => Promise<T>, db: DB = getDb()): Promise<T> {
  return db.transaction(async (tx) => {
    await setIdentity(tx, 'authenticated', userId);
    return fn(tx);
  });
}

/** معاملة زائر غير مسجّل: المحتوى العام فقط */
export function asAnon<T>(fn: (tx: Tx) => Promise<T>, db: DB = getDb()): Promise<T> {
  return db.transaction(async (tx) => {
    await setIdentity(tx, 'anon', null);
    return fn(tx);
  });
}

/**
 * معاملة النظام: تتجاوز RLS، فلا تُستدعى إلا بعد فحص الصلاحية في الخادم.
 * actorId يُحفظ في الهوية ليُنسب إليه ما يُكتب في سجل التدقيق.
 */
export function asSystem<T>(actorId: string | null, fn: (tx: Tx) => Promise<T>, db: DB = getDb()): Promise<T> {
  return db.transaction(async (tx) => {
    await setIdentity(tx, 'service_role', actorId);
    return fn(tx);
  });
}

export { schema };
