'use client';

import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IS_LIVE } from '@/lib/api';
import { asset } from '@/lib/base';
import { SURAHS } from '@/lib/quran';
import { searchKey } from '@/lib/quran/search';

type Hit = { surah: number; ayah: number; page: number; text: string };
type Row = [number, number, number, string, string];

// النسخة الثابتة بلا خادم: يُنزَّل فهرس الآيات مرة (نحو 500 كيلوبايت مضغوطاً)
// ويُبحث فيه بالمتصفح بالمفتاح نفسه الذي يستعمله الخادم
let index: Promise<Row[]> | undefined;
const loadIndex = () => (index ??= fetch(asset('/data/ayahs.json')).then((r) => r.json()));

async function searchLocally(term: string): Promise<Hit[]> {
  const key = searchKey(term);
  const out: Hit[] = [];
  for (const [surah, ayah, page, text, k] of await loadIndex()) {
    if (k.includes(key)) out.push({ surah, ayah, page, text });
    if (out.length >= 40) break;
  }
  return out;
}

/** بحث بالاسم أو رقم الصفحة أو بكلمة من الآيات (يتجاهل التشكيل) */
export function MushafSearch({ base }: { base: string }) {
  const [q, setQ] = useState('');
  const [result, setHits] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);

  const term = q.trim();
  const page = /^\d{1,3}$/.test(term) && Number(term) >= 1 && Number(term) <= 604 ? Number(term) : undefined;
  const surahs = term && !page ? SURAHS.filter((s) => s.name.includes(term) || s.name.replace(/^ال/, '').startsWith(term)).slice(0, 5) : [];

  const searching = term.length >= 3 && !page;

  useEffect(() => {
    if (!searching) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        if (!IS_LIVE) {
          const found = await searchLocally(term);
          if (!ctrl.signal.aborted) setHits(found);
          return;
        }
        const res = await fetch(`/api/v1/quran/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const json = await res.json();
        setHits(res.ok ? json.data : []);
      } catch {
        /* أُلغي الطلب أو انقطع الاتصال */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, searching]);

  const hits = searching ? result : null;

  return (
    <div className="relative">
      <label htmlFor="mushaf-q" className="sr-only">
        ابحثي في المصحف
      </label>
      <Search className="pointer-events-none absolute inset-y-0 start-4 my-auto size-5 text-muted" aria-hidden />
      <input
        id="mushaf-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="سورة، رقم صفحة، أو كلمة من آية"
        className="h-12 w-full rounded-card bg-card ps-12 pe-11 text-[15px] text-ink shadow-card outline-none placeholder:text-muted/70 focus:ring-1 focus:ring-gold [&::-webkit-search-cancel-button]:hidden"
      />
      {q && (
        <button type="button" aria-label="مسح" onClick={() => setQ('')} className="absolute inset-y-0 end-3 my-auto grid size-7 place-items-center rounded-full text-muted hover:bg-field">
          <X className="size-4" />
        </button>
      )}

      {term && (
        <div className="absolute inset-x-0 top-14 z-30 max-h-[60vh] overflow-y-auto rounded-card bg-card p-2 shadow-lift" role="region" aria-live="polite" aria-label="نتائج البحث">
          {page && (
            <Link href={`${base}/${page}`} className="block rounded-ctl px-3 py-2.5 font-bold text-brand hover:bg-field">
              انتقلي إلى الصفحة {page}
            </Link>
          )}
          {surahs.map((s) => (
            <Link key={s.id} href={`${base}/${s.startPage}`} className="flex items-center justify-between rounded-ctl px-3 py-2.5 hover:bg-field">
              <span className="font-bold text-ink">سورة {s.name}</span>
              <span className="text-xs text-muted">صفحة {s.startPage}</span>
            </Link>
          ))}
          {loading && <p className="px-3 py-2 text-sm text-muted">جارٍ البحث…</p>}
          {hits?.map((h) => (
            <Link key={`${h.surah}:${h.ayah}`} href={`${base}/${h.page}`} className="block rounded-ctl px-3 py-2.5 hover:bg-field">
              <span className="block font-quran text-lg leading-loose text-ink">{h.text}</span>
              <span className="text-xs text-muted">
                {SURAHS[h.surah - 1].name} {h.ayah} · صفحة {h.page}
              </span>
            </Link>
          ))}
          {hits && !hits.length && !surahs.length && !loading && <p className="px-3 py-2 text-sm text-muted">لا نتائج.</p>}
          {!page && !surahs.length && !hits && !loading && term.length < 3 && (
            <p className="px-3 py-2 text-sm text-muted">اكتبي ثلاثة أحرف على الأقل للبحث في الآيات.</p>
          )}
        </div>
      )}
    </div>
  );
}
