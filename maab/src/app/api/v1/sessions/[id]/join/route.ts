import { route } from '@/server/api/route';
import { joinSession } from '@/server/services/scheduling';

// يسجّل الحضور ثم يحوّل لرابط Meet؛ الرابط لا يظهر في أي استجابة أخرى
export const GET = route<{ id: string }>({}, async (ctx) => {
  const url = await joinSession(ctx.viewer, ctx.params.id);
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
});
