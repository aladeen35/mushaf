import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { asUser } from '@/server/db/client';
import { notifications } from '@/server/db/schema';

export const POST = route({}, async (ctx) => {
  const body = await ctx.json(S.notificationsRead);
  const rows = await asUser(ctx.viewer.userId, (tx) =>
    tx
      .update(notifications)
      .set({ readAt: new Date(), status: 'read' })
      .where(and(eq(notifications.userId, ctx.viewer.userId), isNull(notifications.readAt), 'ids' in body ? inArray(notifications.id, body.ids) : undefined))
      .returning({ id: notifications.id }),
  );
  return { marked: rows.length };
});
