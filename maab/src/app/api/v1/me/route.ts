import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { getMe, updateMe } from '@/server/services/account';

export const GET = route({}, async ({ viewer }) => getMe(viewer));

export const PATCH = route({}, async (ctx) => updateMe(ctx.viewer, await ctx.json(S.mePatch)));
