import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { createRefund } from '@/server/services/billing';

export const POST = route({ can: 'payments.refund', idempotent: true }, async (ctx) => createRefund(ctx.viewer, await ctx.json(S.refund), ctx.ip));
