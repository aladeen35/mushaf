import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { badRequest } from '@/server/api/http';
import { listSessions } from '@/server/services/scheduling';

export const GET = route({}, async (ctx) => {
  const q = ctx.query(S.sessionsQuery);
  if (q.to.getTime() - q.from.getTime() > 92 * 86_400_000) throw badRequest('range_too_long', 'المدة أطول من ثلاثة أشهر');
  return listSessions(ctx.viewer, q);
});
