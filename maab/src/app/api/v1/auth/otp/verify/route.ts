import { parsePhone } from '@/lib/phone';
import { badRequest } from '@/server/api/http';
import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { verifyOtp } from '@/server/auth/otp';
import { sessionCookie, signSession } from '@/server/auth/session';
import { homeFor, signInUser, type SignInIdentity } from '@/server/auth/users';

export const POST = route({ auth: 'public', limit: { max: 20, windowSec: 600 } }, async (ctx) => {
  const body = await ctx.json(S.otpVerify);
  let identifier: string;
  let identity: SignInIdentity;
  if ('phone' in body) {
    const p = parsePhone(body.phone, body.country);
    if (!p) throw badRequest('phone_invalid', 'رقم الجوال غير صحيح');
    identifier = p.e164;
    identity = { kind: 'phone', phone: p.e164, country: p.country };
  } else {
    identifier = body.email.trim().toLowerCase();
    identity = { kind: 'email', email: identifier, country: body.country };
  }
  await verifyOtp(identifier, body.code, { ip: ctx.ip, userAgent: ctx.userAgent });
  const { user, roles, created } = await signInUser(identity);
  const { token, maxAge } = await signSession({ userId: user.id, roles });
  ctx.headers.append('Set-Cookie', sessionCookie(token, maxAge));
  return { userId: user.id, roles, created, next: homeFor(roles) };
});
