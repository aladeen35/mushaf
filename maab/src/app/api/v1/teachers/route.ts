import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { listTeachers } from '@/server/services/teachers';

export const GET = route({}, async (ctx) => listTeachers(ctx.query(S.teachersQuery)));
