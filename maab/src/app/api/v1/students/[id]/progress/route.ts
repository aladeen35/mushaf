import { route } from '@/server/api/route';
import { studentProgress } from '@/server/services/reports';

export const GET = route<{ id: string }>({}, async ({ viewer, params }) => studentProgress(viewer, params.id));
