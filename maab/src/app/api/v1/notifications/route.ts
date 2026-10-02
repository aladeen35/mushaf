import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { asUser } from '@/server/db/client';
import { listNotifications } from '@/server/services/notifications';

export const GET = route({}, async (ctx) => {
  const { cursor } = ctx.query(S.notificationsQuery);
  return asUser(ctx.viewer.userId, (tx) => listNotifications(tx, ctx.viewer.userId, cursor));
});
