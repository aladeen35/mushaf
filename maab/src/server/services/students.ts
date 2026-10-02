// الطلاب وإكمال الحساب (القسمان 4 و5): ولي الأمر يضيف أبناءه (الأولاد حتى
// 12 سنة)، والطالبة البالغة ولية أمر نفسها. رمز دخول القاصر يصدره ولي الأمر.
import { createHmac, randomInt } from 'node:crypto';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { can, type Role } from '@/lib/domain/permissions';
import { ADULT_AGE, eligibility, type Gender } from '@/lib/domain/students';
import { isValidTimezone } from '@/lib/tz';
import { asSystem, asUser, type Tx } from '../db/client';
import { consents, guardians, guardianStudents, students, subscriptions, teachers, userRoles, users } from '../db/schema';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../api/http';
import type { Viewer } from '../api/route';
import { env } from '../env';
import { audit } from './audit';
import { flagEnabled, getSetting } from './settings';

export const CONSENT_VERSION = '2026-10';

export function ageOn(birthDate: string, now = new Date()): number {
  const b = new Date(`${birthDate}T00:00:00Z`);
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

async function checkEligible(tx: Tx, gender: Gender, birthDate: string) {
  const maxBoy = await getSetting(tx, 'max_boy_age');
  const e = eligibility(gender, ageOn(birthDate), maxBoy);
  if (!e.ok) {
    throw new ApiError(422, e.reason, e.reason === 'boy_too_old' ? `الأكاديمية تقبل الأولاد حتى ${maxBoy} سنة` : 'أقل عمر للتسجيل 4 سنوات');
  }
}

// —— إكمال الحساب ——

export type OnboardingInput = {
  fullName: string;
  kind: 'guardian' | 'self';
  city?: string | null;
  timezone?: string;
  acceptTerms: true;
  self?: { birthDate: string; level?: string | null; goal?: string | null };
};

export async function completeOnboarding(viewer: Viewer, input: OnboardingInput, meta: { ip?: string | null; userAgent?: string | null }) {
  if (input.timezone && !isValidTimezone(input.timezone)) throw badRequest('timezone_invalid', 'منطقة زمنية غير معروفة');
  return asSystem(viewer.userId, async (tx) => {
    const [existing] = await tx.select({ id: guardians.id }).from(guardians).where(eq(guardians.userId, viewer.userId));
    if (existing || viewer.roles.length) throw conflict('already_onboarded', 'أُكمل الحساب من قبل');
    await tx
      .update(users)
      .set({ fullName: input.fullName.trim(), city: input.city ?? null, ...(input.timezone ? { timezone: input.timezone } : {}) })
      .where(eq(users.id, viewer.userId));
    const [g] = await tx.insert(guardians).values({ userId: viewer.userId }).returning();
    const roles: Role[] = [];
    if (input.kind === 'self') {
      if (!input.self) throw badRequest('self_required', 'أدخلي تاريخ الميلاد');
      if (ageOn(input.self.birthDate) < ADULT_AGE) throw new ApiError(422, 'not_adult', 'التسجيل الذاتي للطالبات من 18 سنة؛ دون ذلك يسجّل ولي الأمر');
      const [st] = await tx
        .insert(students)
        .values({
          userId: viewer.userId,
          fullName: input.fullName.trim(),
          displayName: input.fullName.trim().split(/\s+/)[0],
          gender: 'female',
          birthDate: input.self.birthDate,
          level: input.self.level ?? null,
          goal: input.self.goal ?? null,
        })
        .returning();
      await tx.insert(guardianStudents).values({ guardianId: g.id, studentId: st.id, relation: 'self' });
      roles.push('adult_student');
    } else {
      roles.push('guardian');
    }
    await tx.insert(userRoles).values(roles.map((role) => ({ userId: viewer.userId, role })));
    await tx.insert(consents).values(
      (['terms', 'privacy'] as const).map((kind) => ({ userId: viewer.userId, kind, version: CONSENT_VERSION, ip: meta.ip ?? null, userAgent: meta.userAgent ?? null })),
    );
    await audit(tx, viewer, { action: 'account.onboard', entity: 'users', entityId: viewer.userId, after: { kind: input.kind, roles } }, meta.ip);
    return { roles };
  });
}

// —— الطلاب ——

export async function listStudents(viewer: Viewer) {
  return asUser(viewer.userId, async (tx) => {
    const rows = await tx
      .select({ s: students, teacher: teachers.displayName })
      .from(students)
      .leftJoin(teachers, eq(teachers.id, students.teacherId))
      .where(isNull(students.deletedAt))
      .orderBy(students.createdAt);
    const ids = rows.map((r) => r.s.id);
    const subs = ids.length
      ? await tx
          .select()
          .from(subscriptions)
          .where(and(inArray(subscriptions.studentId, ids), eq(subscriptions.status, 'active')))
          .orderBy(desc(subscriptions.expiresAt))
      : [];
    return rows.map(({ s, teacher }) => {
      const sub = subs.find((x) => x.studentId === s.id);
      return {
        id: s.id,
        fullName: s.fullName,
        displayName: s.displayName,
        gender: s.gender,
        birthDate: s.birthDate,
        age: ageOn(s.birthDate),
        level: s.level,
        goal: s.goal,
        teacherId: s.teacherId,
        teacher,
        hasLogin: Boolean(s.loginCodeHash),
        balance: sub ? { remaining: sub.sessionsRemaining, expiresAt: sub.expiresAt } : null,
      };
    });
  });
}

export type ChildInput = { fullName: string; displayName?: string; gender: Gender; birthDate: string; level?: string | null; goal?: string | null };

export async function addChild(viewer: Viewer, input: ChildInput, meta: { ip?: string | null; userAgent?: string | null }) {
  if (!can(viewer.roles, 'students.manage')) throw forbidden();
  return asSystem(viewer.userId, async (tx) => {
    const [g] = await tx.select().from(guardians).where(and(eq(guardians.userId, viewer.userId), isNull(guardians.deletedAt)));
    if (!g) throw forbidden();
    await checkEligible(tx, input.gender, input.birthDate);
    const [st] = await tx
      .insert(students)
      .values({
        fullName: input.fullName.trim(),
        displayName: (input.displayName ?? input.fullName).trim().split(/\s+/)[0],
        gender: input.gender,
        birthDate: input.birthDate,
        level: input.level ?? null,
        goal: input.goal ?? null,
      })
      .returning();
    await tx.insert(guardianStudents).values({ guardianId: g.id, studentId: st.id, relation: 'parent' });
    // موافقة ولي الأمر على معالجة بيانات القاصر وعدم تسجيل الحصص (القسم 15)
    if (ageOn(st.birthDate) < ADULT_AGE) {
      await tx.insert(consents).values(
        (['minor_data', 'no_recording'] as const).map((kind) => ({ userId: viewer.userId, studentId: st.id, kind, version: CONSENT_VERSION, ip: meta.ip ?? null, userAgent: meta.userAgent ?? null })),
      );
    }
    await audit(tx, viewer, { action: 'student.create', entity: 'students', entityId: st.id, after: { displayName: st.displayName, gender: st.gender, birthDate: st.birthDate } }, meta.ip);
    return { id: st.id, displayName: st.displayName, age: ageOn(st.birthDate) };
  });
}

export type StudentPatch = { displayName?: string; fullName?: string; level?: string | null; goal?: string | null; birthDate?: string; teacherId?: string | null };

export async function updateStudent(viewer: Viewer, studentId: string, patch: StudentPatch, ip?: string | null) {
  return asSystem(viewer.userId, async (tx) => {
    const [st] = await tx.select().from(students).where(and(eq(students.id, studentId), isNull(students.deletedAt)));
    if (!st) throw notFound('الطالب');
    const [link] = await tx
      .select({ id: guardians.id })
      .from(guardianStudents)
      .innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId))
      .where(and(eq(guardianStudents.studentId, st.id), eq(guardians.userId, viewer.userId)));
    const isFamily = Boolean(link) && can(viewer.roles, 'students.read.own');
    const assigns = can(viewer.roles, 'teachers.assign');
    if (!isFamily && !assigns && !can(viewer.roles, 'students.read.all')) throw forbidden();
    if (patch.teacherId !== undefined && !assigns) throw forbidden();
    const set: Partial<typeof students.$inferInsert> = {};
    if (patch.displayName !== undefined) set.displayName = patch.displayName.trim();
    if (patch.fullName !== undefined) set.fullName = patch.fullName.trim();
    if (patch.level !== undefined) set.level = patch.level;
    if (patch.goal !== undefined) set.goal = patch.goal;
    if (patch.birthDate !== undefined) set.birthDate = patch.birthDate;
    if (patch.teacherId !== undefined) set.teacherId = patch.teacherId;
    if (!Object.keys(set).length) return { id: st.id };
    const [after] = await tx.update(students).set(set).where(eq(students.id, st.id)).returning();
    await audit(tx, viewer, { action: 'student.update', entity: 'students', entityId: st.id, before: st, after }, ip);
    return { id: after.id, displayName: after.displayName, teacherId: after.teacherId };
  });
}

// —— رمز دخول القاصر ——

/** بلا أحرف ملتبسة (0/O، 1/I/L) لتُملى على الطفل بسهولة */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const hashStudentCode = (code: string) =>
  createHmac('sha256', env().AUTH_SECRET).update(`student:${code.toUpperCase().replace(/[^A-Z0-9]/g, '')}`).digest('hex');

export async function issueStudentCode(viewer: Viewer, studentId: string, ip?: string | null): Promise<{ code: string }> {
  return asSystem(viewer.userId, async (tx) => {
    if (!(await flagEnabled(tx, 'minor_student_login'))) throw new ApiError(404, 'feature_off', 'الميزة غير مفعّلة');
    const [link] = await tx
      .select({ st: students, g: guardians })
      .from(guardianStudents)
      .innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId))
      .innerJoin(students, eq(students.id, guardianStudents.studentId))
      .where(and(eq(guardianStudents.studentId, studentId), eq(guardians.userId, viewer.userId), eq(guardianStudents.relation, 'parent')));
    if (!link) throw forbidden();
    if (ageOn(link.st.birthDate) >= ADULT_AGE) throw conflict('not_minor', 'الطالبة البالغة تدخل برقمها');
    let userId = link.st.userId;
    if (!userId) {
      const [parent] = await tx.select().from(users).where(eq(users.id, viewer.userId));
      const [u] = await tx
        .insert(users)
        .values({ studentLogin: true, fullName: link.st.displayName, country: parent.country, timezone: parent.timezone, currency: parent.currency })
        .returning();
      await tx.insert(userRoles).values({ userId: u.id, role: 'minor_student' });
      await tx.update(students).set({ userId: u.id }).where(eq(students.id, studentId));
      userId = u.id;
    }
    // رمز جديد يُبطل القديم؛ يُعاد التوليد عند تصادم البصمة (نادر جداً)
    for (let i = 0; i < 5; i++) {
      const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
      const hash = hashStudentCode(code);
      const taken = await tx.select({ id: students.id }).from(students).where(eq(students.loginCodeHash, hash));
      if (taken.length) continue;
      await tx.update(students).set({ loginCodeHash: hash }).where(eq(students.id, studentId));
      await audit(tx, viewer, { action: 'student.login_code', entity: 'students', entityId: studentId }, ip);
      return { code };
    }
    throw new Error('تعذّر توليد رمز فريد');
  });
}

/** دخول القاصر برمزه: يعيد مستخدمه الفرعي */
export async function studentByCode(code: string): Promise<{ userId: string; roles: Role[] } | null> {
  return asSystem(null, async (tx) => {
    const [st] = await tx
      .select({ userId: students.userId })
      .from(students)
      .where(and(eq(students.loginCodeHash, hashStudentCode(code)), isNull(students.deletedAt)));
    if (!st?.userId) return null;
    const roles = await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, st.userId));
    await tx.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, st.userId));
    return { userId: st.userId, roles: roles.map((r) => r.role) };
  });
}
