import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { addChild, listStudents } from '@/server/services/students';

export const GET = route({}, async ({ viewer }) => listStudents(viewer));

export const POST = route({ can: 'students.manage' }, async (ctx) =>
  addChild(ctx.viewer, await ctx.json(S.childCreate), { ip: ctx.ip, userAgent: ctx.userAgent }),
);
