import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { auditLog } from '@/server/services/admin';

export const GET = route({ can: 'audit.read' }, async (ctx) => auditLog(ctx.viewer, ctx.query(S.auditQuery)));
