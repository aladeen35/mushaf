import { route } from '@/server/api/route';
import { paymentDetail } from '@/server/services/billing';

export const GET = route<{ id: string }>({ can: 'payments.approve' }, async ({ viewer, params }) => paymentDetail(viewer, params.id));
