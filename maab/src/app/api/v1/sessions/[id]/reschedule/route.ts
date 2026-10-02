import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { rescheduleSession } from '@/server/services/scheduling';

export const POST = route<{ id: string }>({}, async (ctx) => rescheduleSession(ctx.viewer, ctx.params.id, await ctx.json(S.reschedule), ctx.ip));
