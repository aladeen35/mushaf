// جلسة الدخول: رمز JWT موقّع في كوكيز HttpOnly وSecure وSameSite=Lax (القسم 15).
// هويته (sub) هي نفسها هوية RLS في قاعدة البيانات. جلسة أدوار الإدارة تنتهي
// بعد 30 دقيقة خمول وتتجدّد مع كل طلب، وجلسة بقية المستخدمين 30 يوماً.
import { jwtVerify, SignJWT } from 'jose';
import { isStaff, type Role } from '@/lib/domain/permissions';
import { env, isProduction } from '../env';

export const SESSION_COOKIE = 'maab_session';
const USER_TTL_SEC = 30 * 86_400;
const STAFF_IDLE_SEC = 30 * 60;

export type Session = { userId: string; roles: Role[]; impersonatedBy?: string };

const key = () => new TextEncoder().encode(env().AUTH_SECRET);

export async function signSession(s: Session): Promise<{ token: string; maxAge: number }> {
  const maxAge = isStaff(s.roles) ? STAFF_IDLE_SEC : USER_TTL_SEC;
  const token = await new SignJWT({ roles: s.roles, imp: s.impersonatedBy })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .setAudience('maab')
    .sign(key());
  return { token, maxAge };
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { audience: 'maab', algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return { userId: payload.sub, roles: (payload.roles as Role[]) ?? [], impersonatedBy: payload.imp as string | undefined };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, maxAge: number): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    ...(isProduction() ? ['Secure'] : []),
  ].join('; ');
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction() ? '; Secure' : ''}`;
