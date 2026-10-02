import { searchKey } from '@/lib/quran/search';
import { searchAyahs } from '@/lib/quran/server';

// GET /api/v1/quran/search?q=... — بحث بكلمة مع تجاهل التشكيل (القسم 10)
// الأخطاء بالصيغة الموحّدة {code, message_ar, details} (القسم 14)
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length > 80) {
    return Response.json({ code: 'query_too_long', message_ar: 'عبارة البحث أطول من المسموح', details: { max: 80 } }, { status: 400 });
  }
  const key = searchKey(q);
  if (key.length < 2) {
    return Response.json({ code: 'query_too_short', message_ar: 'اكتبي حرفين على الأقل', details: { min: 2 } }, { status: 400 });
  }
  const results = searchAyahs(key, 40);
  return Response.json(
    { data: results, meta: { count: results.length, limit: 40 } },
    { headers: { 'Cache-Control': 'public, max-age=86400, immutable' } },
  );
}
