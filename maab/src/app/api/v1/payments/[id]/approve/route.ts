import { route } from '@/server/api/route';
import { approvePayment } from '@/server/services/billing';

export const POST = route<{ id: string }>({ can: 'payments.approve', idempotent: true }, async (ctx) => approvePayment(ctx.viewer, ctx.params.id, ctx.ip));
