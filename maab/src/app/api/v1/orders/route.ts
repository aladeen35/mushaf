import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { createOrder } from '@/server/services/billing';

export const POST = route({ can: ['plans.purchase', 'plans.purchase.on_behalf'], idempotent: true }, async (ctx) =>
  createOrder(ctx.viewer, await ctx.json(S.order), ctx.ip),
);
