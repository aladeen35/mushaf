import { SURAHS } from '@/lib/quran';

export const dynamic = 'force-static';

export function GET() {
  return Response.json({ data: SURAHS }, { headers: { 'Cache-Control': 'public, max-age=86400, immutable' } });
}
