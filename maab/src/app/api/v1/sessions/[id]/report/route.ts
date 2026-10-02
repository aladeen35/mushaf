import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { submitReport } from '@/server/services/reports';

export const POST = route<{ id: string }>({ can: ['reports.write', 'reports.edit'] }, async (ctx) =>
  submitReport(ctx.viewer, ctx.params.id, await ctx.json(S.report), ctx.ip),
);
