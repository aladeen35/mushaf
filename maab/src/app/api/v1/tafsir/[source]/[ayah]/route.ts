import { fromIndex, isValidRef, type AyahRef } from '@/lib/quran';
import { pageOf, tafsirForPage } from '@/lib/quran/server';

// الميسّر مخزّن محلياً؛ المرجع بصيغة 2:255 أو رقم الآية في المصحف كله
export async function GET(_req: Request, ctx: { params: Promise<{ source: string; ayah: string }> }) {
  const { source, ayah } = await ctx.params;
  if (source !== 'muyassar') {
    return Response.json({ code: 'source_unavailable', message_ar: 'هذا التفسير غير متاح بعد', details: { available: ['muyassar'] } }, { status: 404 });
  }
  const parts = ayah.split(':').map(Number);
  const ref: AyahRef | null = parts.length === 2 ? { surah: parts[0], ayah: parts[1] } : Number.isInteger(parts[0]) && parts[0] >= 1 && parts[0] <= 6236 ? fromIndex(parts[0]) : null;
  if (!ref || !isValidRef(ref)) return Response.json({ code: 'ayah_invalid', message_ar: 'مرجع آية غير صحيح', details: null }, { status: 400 });
  const key = (r: AyahRef) => r.surah * 1000 + r.ayah;
  const entry = tafsirForPage(pageOf(ref)).find((e) => key(e.from) <= key(ref) && key(ref) <= key(e.to));
  if (!entry) return Response.json({ code: 'not_found', message_ar: 'لا يوجد تفسير لهذه الآية', details: null }, { status: 404 });
  return Response.json({ data: { source, ...entry } }, { headers: { 'Cache-Control': 'public, max-age=86400, immutable' } });
}
