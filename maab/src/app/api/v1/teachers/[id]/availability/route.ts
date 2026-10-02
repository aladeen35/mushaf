import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { getAvailability, putAvailability } from '@/server/services/teachers';

export const GET = route<{ id: string }>({}, async ({ params }) => getAvailability(params.id));

export const PUT = route<{ id: string }>({ can: ['availability.manage.own', 'teachers.assign'] }, async (ctx) =>
  putAvailability(ctx.viewer, ctx.params.id, await ctx.json(S.availability), ctx.ip),
);
