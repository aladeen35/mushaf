import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { rejectPayment } from '@/server/services/billing';

export const POST = route<{ id: string }>({ can: 'payments.approve' }, async (ctx) =>
  rejectPayment(ctx.viewer, ctx.params.id, await ctx.json(S.reject), ctx.ip),
);
