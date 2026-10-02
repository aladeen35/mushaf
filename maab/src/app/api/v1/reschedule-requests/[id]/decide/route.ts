import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { decideReschedule } from '@/server/services/scheduling';

export const POST = route<{ id: string }>({}, async (ctx) => decideReschedule(ctx.viewer, ctx.params.id, (await ctx.json(S.decide)).accept, ctx.ip));
