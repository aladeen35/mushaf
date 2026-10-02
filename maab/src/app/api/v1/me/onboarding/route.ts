import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { sessionCookie, signSession } from '@/server/auth/session';
import { homeFor } from '@/server/auth/users';
import { completeOnboarding } from '@/server/services/students';

export const POST = route({}, async (ctx) => {
  const input = await ctx.json(S.onboarding);
  const { roles } = await completeOnboarding(ctx.viewer, input, { ip: ctx.ip, userAgent: ctx.userAgent });
  // الأدوار الجديدة في الجلسة فوراً
  const { token, maxAge } = await signSession({ userId: ctx.viewer.userId, roles });
  ctx.headers.append('Set-Cookie', sessionCookie(token, maxAge));
  return { roles, next: homeFor(roles) };
});
