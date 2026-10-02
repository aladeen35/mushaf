// الحساب: بيانات المستخدم الحالي وتفضيلاته، والدخول بحساب Google لمن هم
// خارج السعودية (رمز Google ID يُتحقق منه بمفاتيح Google العامة).
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { and, eq, isNull } from 'drizzle-orm';
import { asSystem } from '../db/client';
import { guardians, teachers, users } from '../db/schema';
import { ApiError, badRequest } from '../api/http';
import type { Viewer } from '../api/route';
import { env } from '../env';
import { isValidTimezone } from '@/lib/tz';

export async function getMe(viewer: Viewer) {
  return asSystem(viewer.userId, async (tx) => {
    const [g] = await tx.select({ id: guardians.id }).from(guardians).where(and(eq(guardians.userId, viewer.userId), isNull(guardians.deletedAt)));
    const [t] = await tx.select({ id: teachers.id, status: teachers.status }).from(teachers).where(eq(teachers.userId, viewer.userId));
    const [u] = await tx.select({ prefs: users.notificationPrefs, city: users.city }).from(users).where(eq(users.id, viewer.userId));
    return {
      ...viewer.user,
      city: u.city,
      roles: viewer.roles,
      impersonatedBy: viewer.impersonatedBy ?? null,
      guardianId: g?.id ?? null,
      teacherId: t?.id ?? null,
      notificationPrefs: u.prefs,
    };
  });
}

export async function updateMe(viewer: Viewer, patch: { fullName?: string; city?: string | null; timezone?: string }) {
  if (patch.timezone && !isValidTimezone(patch.timezone)) throw badRequest('timezone_invalid', 'منطقة زمنية غير معروفة');
  return asSystem(viewer.userId, async (tx) => {
    const [u] = await tx
      .update(users)
      .set({
        ...(patch.fullName ? { fullName: patch.fullName } : {}),
        ...(patch.city !== undefined ? { city: patch.city } : {}),
        ...(patch.timezone ? { timezone: patch.timezone } : {}),
      })
      .where(eq(users.id, viewer.userId))
      .returning({ fullName: users.fullName, city: users.city, timezone: users.timezone });
    return u;
  });
}

export async function setNotificationPrefs(viewer: Viewer, prefs: Record<string, Partial<Record<'whatsapp' | 'email' | 'sms' | 'push', boolean>>>) {
  return asSystem(viewer.userId, async (tx) => {
    const [u] = await tx.update(users).set({ notificationPrefs: prefs }).where(eq(users.id, viewer.userId)).returning({ prefs: users.notificationPrefs });
    return u.prefs;
  });
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/** يتحقق من رمز Google Identity Services ويعيد هوية صاحبه */
export async function verifyGoogleCredential(credential: string): Promise<{ sub: string; email: string | null; name: string | null }> {
  const clientId = env().GOOGLE_CLIENT_ID;
  if (!clientId) throw new ApiError(503, 'google_disabled', 'الدخول بحساب Google غير مفعّل حالياً');
  try {
    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId });
    if (!payload.sub) throw new Error('no sub');
    const verified = payload.email_verified === true || payload.email_verified === 'true';
    return { sub: payload.sub, email: verified ? String(payload.email ?? '') || null : null, name: (payload.name as string | undefined) ?? null };
  } catch {
    throw new ApiError(401, 'google_invalid', 'تعذّر التحقق من حساب Google');
  }
}
