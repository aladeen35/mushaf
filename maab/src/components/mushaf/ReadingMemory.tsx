'use client';

import { Bookmark, BookmarkCheck, BookOpenText, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

// موضع القراءة والعلامة المرجعية محفوظان في الجهاز. عند ربط الحساب
// تُزامَن مع جدول bookmarks (القسم 13).
const LAST = 'maab-last-page';
const MARK = 'maab-bookmark';

function get(key: string): number | undefined {
  try {
    const v = Number(localStorage.getItem(key));
    return v >= 1 && v <= 604 ? v : undefined;
  } catch {
    return undefined;
  }
}

function set(key: string, v?: number) {
  try {
    if (v) localStorage.setItem(key, String(v));
    else localStorage.removeItem(key);
  } catch {}
}

/** يُسجّل الصفحة المفتوحة موضعًا أخيرًا للقراءة، ويتيح علامة مرجعية */
export function PageMemory({ page }: { page: number }) {
  const [marked, setMarked] = useState(false);
  useEffect(() => {
    set(LAST, page);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMarked(get(MARK) === page);
  }, [page]);
  return (
    <button
      type="button"
      aria-pressed={marked}
      aria-label={marked ? 'إزالة العلامة المرجعية' : 'وضع علامة مرجعية'}
      onClick={() => {
        set(MARK, marked ? undefined : page);
        setMarked(!marked);
      }}
      className={cn('grid size-10 place-items-center rounded-full hover:bg-white/10', marked ? 'text-gold' : 'text-on-hero')}
    >
      {marked ? <BookmarkCheck className="size-6" /> : <Bookmark className="size-6" />}
    </button>
  );
}

/** بطاقة «متابعة القراءة» في فهرس المصحف */
export function ContinueReading({ base, fallback }: { base: string; fallback: number }) {
  const [last, setLast] = useState<number>();
  const [mark, setMark] = useState<number>();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLast(get(LAST));
    setMark(get(MARK));
  }, []);
  const page = last ?? fallback;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <Link href={`${base}/${page}`} className="flex items-center gap-3 rounded-card bg-brand p-3.5 text-on-brand shadow-card hover:bg-brand-soft">
        <span className="grid size-10 place-items-center rounded-ctl bg-white/12 text-gold" aria-hidden>
          <BookOpenText className="size-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold">{last ? 'متابعة القراءة' : 'ورد اليوم'}</span>
          <span className="tabular block text-xs opacity-80">الصفحة {page}</span>
        </span>
        <ChevronLeft className="size-5 opacity-80" aria-hidden />
      </Link>
      <Link
        href={mark ? `${base}/${mark}` : `${base}/1`}
        className="flex flex-col items-center justify-center gap-0.5 rounded-card bg-card px-4 text-gold-text shadow-card hover:bg-field"
        aria-label={mark ? `العلامة المرجعية: صفحة ${mark}` : 'لا علامة مرجعية'}
      >
        <Bookmark className={cn('size-5', mark && 'fill-gold text-gold')} aria-hidden />
        <span className="tabular text-[11px] font-bold">{mark ?? '—'}</span>
      </Link>
    </div>
  );
}
