import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { cn } from '@/lib/cn';
import { ayahMark, formatRange, surah, TOTAL_PAGES } from '@/lib/quran';
import { juzOrdinal } from '@/lib/quran/names';
import { loadPage, tafsirForPage, type QuranLine } from '@/lib/quran/server';
import { PageMemory } from './ReadingMemory';

const BASMALAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

function SurahBanner({ id }: { id: number }) {
  return (
    <div className="mx-[3%] flex h-[1.7em] items-center justify-center self-center rounded-[10px] border-[1.5px] border-gold bg-gradient-to-l from-gold/10 via-gold/20 to-gold/10 px-3 outline outline-1 outline-offset-2 outline-gold/50">
      <span className="font-display text-[1.05em] leading-none font-bold text-brand">سورة {surah(id).name}</span>
    </div>
  );
}

function Line({ line, centered }: { line: QuranLine; centered: boolean }) {
  if (line.t === 's') return <SurahBanner id={line.s} />;
  if (line.t === 'b') return <p className="text-center">{BASMALAH}</p>;
  return (
    <p className={cn('quran-line', centered && '[text-align-last:center]')}>
      {line.w.map((w, i) =>
        typeof w === 'number' ? (
          <span key={i} className="text-gold-text">
            {' '}
            {ayahMark(w)}{' '}
          </span>
        ) : (
          <span key={i}>{i ? ` ${w}` : w}</span>
        ),
      )}
    </p>
  );
}

/**
 * صفحة المصحف بأسطرها الخمسة عشر من بيانات مصحف المدينة. النص من قاعدة
 * البيانات المحلية لا من مزوّد خارجي فيعمل دون اتصال (القسم 10).
 */
export function MushafReader({ base, page }: { base: string; page: number }) {
  const data = loadPage(page);
  const names = data.s.map((s) => surah(s).name).join(' · ');
  const tafsir = tafsirForPage(page);
  const centered = page <= 2;

  return (
    <>
      <WaveHeader title={names} back={base} end={<PageMemory page={page} />} className="pb-16">
        <p className="tabular pb-1 text-center text-xs text-on-hero/75">
          {juzOrdinal(data.j)} · الحزب {data.h} · الصفحة {page}
        </p>
      </WaveHeader>

      <main className="relative z-10 -mt-10 space-y-4 px-3">
        <article
          aria-label={`الصفحة ${page}`}
          className="rounded-card border-[3px] border-double border-gold bg-card p-[3px] shadow-lift"
        >
          <div className="rounded-[11px] border border-gold/50 px-[4%] py-4 [container-type:inline-size]">
            <div
              lang="ar"
              className={cn(
                'font-quran text-[clamp(13px,4.5cqw,29px)] leading-[2.15] text-ink',
                centered && 'flex min-h-[60cqw] flex-col justify-center',
              )}
              style={{ display: centered ? undefined : 'grid', gridTemplateRows: centered ? undefined : `repeat(${data.l.length}, 2.15em)` }}
            >
              {data.l.map((line, i) => (
                <Line key={i} line={line} centered={centered} />
              ))}
            </div>
          </div>
          <p className="tabular py-1 text-center text-xs font-bold text-gold-text">{page}</p>
        </article>

        <nav aria-label="تقليب الصفحات" className="grid grid-cols-2 gap-2">
          {page > 1 ? (
            <Link href={`${base}/${page - 1}`} className="flex h-11 items-center justify-center gap-1 rounded-ctl bg-card text-sm font-bold text-brand shadow-card hover:bg-field">
              <ChevronRight className="size-4" aria-hidden />
              السابقة
            </Link>
          ) : (
            <span />
          )}
          {page < TOTAL_PAGES ? (
            <Link href={`${base}/${page + 1}`} className="flex h-11 items-center justify-center gap-1 rounded-ctl bg-brand text-sm font-bold text-on-brand shadow-card hover:bg-brand-soft">
              التالية
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <details className="group rounded-card bg-card shadow-card">
          <summary className="flex h-13 cursor-pointer list-none items-center justify-between px-4 font-bold text-ink [&::-webkit-details-marker]:hidden">
            التفسير الميسّر لآيات الصفحة
            <ChevronDown className="size-5 text-muted transition group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-3 px-4 pb-4">
            {tafsir.map((t) => (
              <p key={`${t.from.surah}:${t.from.ayah}`} className="text-sm leading-7 text-ink">
                <span className="me-1 font-bold text-gold-text">({formatRange(t.from, t.to)})</span>
                {t.text}
              </p>
            ))}
            <p className="text-[11px] text-muted">المصدر: التفسير الميسّر — مجمع الملك فهد لطباعة المصحف الشريف.</p>
          </div>
        </details>
      </main>
    </>
  );
}
