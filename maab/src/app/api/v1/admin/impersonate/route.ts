import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { forbidden } from '@/server/api/http';
import { sessionCookie, signSession } from '@/server/auth/session';
import { rolesOf } from '@/server/auth/users';
import { asSystem } from '@/server/db/client';
import { audit } from '@/server/services/audit';
import { startImpersonation } from '@/server/services/admin';

const IMPERSONATION_SEC = 30 * 60;

export const POST = route({ can: 'support.impersonate' }, async (ctx) => {
  const target = await startImpersonation(ctx.viewer, await ctx.json(S.impersonate), ctx.ip);
  const { token } = await signSession({ userId: target.userId, roles: target.roles, impersonatedBy: ctx.viewer.userId });
  ctx.headers.append('Set-Cookie', sessionCookie(token, IMPERSONATION_SEC));
  return { userId: target.userId, roles: target.roles };
});

/** العودة لحساب موظفة الدعم نفسها */
export const DELETE = route({}, async (ctx) => {
  const staffId = ctx.viewer.impersonatedBy;
  if (!staffId) throw forbidden();
  const roles = await asSystem(staffId, async (tx) => {
    await audit(tx, ctx.viewer, { action: 'support.impersonate_end', entity: 'users', entityId: ctx.viewer.userId }, ctx.ip);
    return rolesOf(tx, staffId);
  });
  const { token, maxAge } = await signSession({ userId: staffId, roles });
  ctx.headers.append('Set-Cookie', sessionCookie(token, maxAge));
  return { userId: staffId, roles };
});
