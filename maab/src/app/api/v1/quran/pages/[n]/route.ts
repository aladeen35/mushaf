import { TOTAL_PAGES } from '@/lib/quran';
import { loadPage } from '@/lib/quran/server';

export async function GET(_req: Request, ctx: { params: Promise<{ n: string }> }) {
  const n = Number((await ctx.params).n);
  if (!Number.isInteger(n) || n < 1 || n > TOTAL_PAGES) {
    return Response.json({ code: 'page_invalid', message_ar: 'رقم الصفحة من 1 إلى 604', details: null }, { status: 400 });
  }
  return Response.json({ data: loadPage(n) }, { headers: { 'Cache-Control': 'public, max-age=86400, immutable' } });
}
