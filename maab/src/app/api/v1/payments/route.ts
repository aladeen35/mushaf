import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { paymentsQueue } from '@/server/services/billing';

export const GET = route({ can: 'payments.approve' }, async (ctx) => paymentsQueue(ctx.viewer, ctx.query(S.paymentsQuery).status));
