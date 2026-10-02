import { route } from '@/server/api/route';
import { joinSession } from '@/server/services/scheduling';

// يسجّل الحضور ثم يحوّل لرابط Meet؛ الرابط لا يظهر في أي استجابة أخرى.
// صفحة الدخول في التطبيق تطلبه بصيغة JSON لتعرض الأخطاء بالعربية.
export const GET = route<{ id: string }>({}, async (ctx) => {
  const url = await joinSession(ctx.viewer, ctx.params.id);
  if (ctx.req.headers.get('accept')?.includes('application/json')) {
    return Response.json({ data: { url } }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
});
