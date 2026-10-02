import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { cancelSession } from '@/server/services/scheduling';

export const POST = route<{ id: string }>({}, async (ctx) => cancelSession(ctx.viewer, ctx.params.id, await ctx.json(S.cancel), ctx.ip));
