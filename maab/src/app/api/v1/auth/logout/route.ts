import { route } from '@/server/api/route';
import { clearSessionCookie } from '@/server/auth/session';

export const POST = route({ auth: 'public' }, async (ctx) => {
  ctx.headers.append('Set-Cookie', clearSessionCookie());
  return { ok: true };
});
