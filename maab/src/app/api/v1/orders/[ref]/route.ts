import { route } from '@/server/api/route';
import { getOrder } from '@/server/services/billing';

export const GET = route<{ ref: string }>({}, async ({ viewer, params }) => getOrder(viewer, params.ref));
