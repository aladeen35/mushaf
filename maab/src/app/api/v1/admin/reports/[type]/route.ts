import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { badRequest } from '@/server/api/http';
import { exportRows, toCsv, type ExportType } from '@/server/services/admin';

const TYPES: ExportType[] = ['payments', 'sessions', 'teachers'];

export const GET = route<{ type: string }>({}, async (ctx) => {
  const type = ctx.params.type as ExportType;
  if (!TYPES.includes(type)) throw badRequest('report_type', 'نوع التقرير غير معروف', { types: TYPES });
  const q = ctx.query(S.exportQuery);
  const rows = await exportRows(ctx.viewer, type, q);
  if (q.format === 'json') return rows;
  const name = `maab-${type}-${q.from.toISOString().slice(0, 10)}.csv`;
  return new Response(toCsv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` } });
});
