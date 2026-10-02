import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { moveApplication } from '@/server/services/teachers';

export const PATCH = route<{ id: string }>({ can: 'teachers.approve' }, async (ctx) =>
  moveApplication(ctx.viewer, ctx.params.id, await ctx.json(S.applicationStatus), ctx.ip),
);
