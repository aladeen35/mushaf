import { route } from '@/server/api/route';
import { dashboard } from '@/server/services/admin';

export const GET = route({}, async ({ viewer }) => dashboard(viewer));
