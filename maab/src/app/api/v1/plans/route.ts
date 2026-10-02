import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { asAnon } from '@/server/db/client';
import { listPlans } from '@/server/services/billing';

// العملة من حساب المستخدم، أو من الطلب للزائر (لعرض الأسعار قبل التسجيل)
export const GET = route({ auth: 'optional' }, async (ctx) => {
  const q = ctx.query(S.plansQuery);
  const currency = ctx.viewer?.user.currency ?? q.currency ?? 'SAR';
  return asAnon((tx) => listPlans(tx, currency));
});
