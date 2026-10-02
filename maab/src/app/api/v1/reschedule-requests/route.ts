import { route } from '@/server/api/route';
import { pendingReschedules } from '@/server/services/scheduling';

export const GET = route({}, async ({ viewer }) => pendingReschedules(viewer));
