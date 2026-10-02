import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { updateStudent } from '@/server/services/students';

export const PATCH = route<{ id: string }>({}, async (ctx) => updateStudent(ctx.viewer, ctx.params.id, await ctx.json(S.studentPatch), ctx.ip));
