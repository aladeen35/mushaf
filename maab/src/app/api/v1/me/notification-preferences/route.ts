import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { setNotificationPrefs } from '@/server/services/account';

export const PUT = route({}, async (ctx) => setNotificationPrefs(ctx.viewer, await ctx.json(S.notificationPrefs)));
