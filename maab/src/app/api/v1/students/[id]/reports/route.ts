import { route } from '@/server/api/route';
import { studentReports } from '@/server/services/reports';

export const GET = route<{ id: string }>({}, async ({ viewer, params }) => studentReports(viewer, params.id));
