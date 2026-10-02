// المستخدم بعد التحقق من رمز الدخول: يُوجد بمعرّفه أو يُنشأ بلا أدوار حتى
// يُكمل التسجيل. الدولة والعملة والمنطقة الزمنية تُستنتج من رقم الجوال
// (+249 ← السودان والجنيه، +966 ← السعودية والريال، وغيرها بالدولار).
import { and, eq, isNull, sql } from 'drizzle-orm';
import { currencyFor, defaultTimezone, type CountryCode } from '@/lib/domain/market';
import { isStaff, type Role } from '@/lib/domain/permissions';
import { asSystem, type Tx } from '../db/client';
import { userRoles, users } from '../db/schema';

export type User = typeof users.$inferSelect;

export type SignInIdentity =
  | { kind: 'phone'; phone: string; country: CountryCode }
  | { kind: 'email'; email: string; country: CountryCode }
  | { kind: 'google'; sub: string; email: string | null; name: string | null; country: CountryCode };

export async function rolesOf(tx: Tx, userId: string): Promise<Role[]> {
  const rows = await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role);
}

const alive = isNull(users.deletedAt);

async function findExisting(tx: Tx, id: SignInIdentity): Promise<User | undefined> {
  if (id.kind === 'phone') return (await tx.select().from(users).where(and(eq(users.phone, id.phone), alive)))[0];
  if (id.kind === 'email') return (await tx.select().from(users).where(and(sql`lower(${users.email}) = lower(${id.email})`, alive)))[0];
  const [bySub] = await tx.select().from(users).where(and(eq(users.googleSub, id.sub), alive));
  if (bySub || !id.email) return bySub;
  // حساب أُنشئ بالبريد نفسه يُربط بحساب Google عند أول دخول به
  return (await tx.select().from(users).where(and(sql`lower(${users.email}) = lower(${id.email})`, alive)))[0];
}

/** يجد المستخدم أو ينشئه؛ آمن مع الطلبات المتزامنة لأن القيود الفريدة تحسم السباق */
export async function signInUser(id: SignInIdentity): Promise<{ user: User; roles: Role[]; created: boolean }> {
  return asSystem(null, async (tx) => {
    let user = await findExisting(tx, id);
    let created = false;
    if (!user) {
      const values = {
        phone: id.kind === 'phone' ? id.phone : null,
        email: id.kind === 'phone' ? null : id.email,
        googleSub: id.kind === 'google' ? id.sub : null,
        fullName: id.kind === 'google' ? (id.name ?? '') : '',
        country: id.country,
        currency: currencyFor(id.country),
        timezone: defaultTimezone(id.country),
      };
      const [inserted] = await tx.insert(users).values(values).onConflictDoNothing().returning();
      user = inserted ?? (await findExisting(tx, id));
      created = Boolean(inserted);
      if (!user) throw new Error('تعذّر إنشاء المستخدم');
    }
    const [updated] = await tx
      .update(users)
      .set({ lastLoginAt: new Date(), ...(id.kind === 'google' && !user.googleSub ? { googleSub: id.sub } : {}) })
      .where(eq(users.id, user.id))
      .returning();
    return { user: updated, roles: await rolesOf(tx, user.id), created };
  });
}

/** الوجهة بعد الدخول حسب الأدوار: من لا دور له يُكمل التسجيل أولاً */
export function homeFor(roles: readonly Role[]): string {
  if (!roles.length) return '/onboarding';
  if (isStaff(roles)) return '/admin';
  if (roles.includes('teacher')) return '/teacher';
  if (roles.length === 1 && roles[0] === 'minor_student') return '/student';
  return '/guardian';
}
