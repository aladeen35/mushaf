import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { asSystem } from '@/server/db/client';
import { checkCoupon } from '@/server/services/billing';

export const POST = route({ limit: { max: 10, windowSec: 600 } }, async (ctx) => {
  const body = await ctx.json(S.couponValidate);
  const { coupon, discount } = await asSystem(ctx.viewer.userId, (tx) =>
    checkCoupon(tx, { userId: ctx.viewer.userId, code: body.code, planCodes: body.planCodes, currency: ctx.viewer.user.currency, subtotal: body.subtotal }),
  );
  return { code: coupon.code, discount, total: Math.round((body.subtotal - discount) * 100) / 100 };
});
