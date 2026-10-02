import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { setPlan } from '@/server/services/reports';

export const PUT = route<{ id: string }>({ can: ['reports.write', 'reports.edit'] }, async (ctx) =>
  setPlan(ctx.viewer, ctx.params.id, await ctx.json(S.plan), ctx.ip),
);
