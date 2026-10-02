import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { sessionCookie, signSession } from '@/server/auth/session';
import { homeFor, signInUser } from '@/server/auth/users';
import { verifyGoogleCredential } from '@/server/services/account';

export const POST = route({ auth: 'public', limit: { max: 20, windowSec: 600 } }, async (ctx) => {
  const body = await ctx.json(S.google);
  const g = await verifyGoogleCredential(body.credential);
  const { user, roles, created } = await signInUser({ kind: 'google', sub: g.sub, email: g.email, name: g.name, country: body.country ?? 'US' });
  const { token, maxAge } = await signSession({ userId: user.id, roles });
  ctx.headers.append('Set-Cookie', sessionCookie(token, maxAge));
  return { userId: user.id, roles, created, next: homeFor(roles) };
});
