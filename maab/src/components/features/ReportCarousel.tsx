'use client';

import { Check, ChevronLeft, Star } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { MushafIcon } from '@/components/brand/MushafIcon';
import { Card, Dots } from '@/components/ui/Card';
import { StatChip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/Progress';
import { cn } from '@/lib/cn';
import { fmtAyahs } from '@/lib/format';

export type ReportSlide = {
  id: string;
  title: string;
  date: string;
  segments: { label: string; range: string; ayahs: number; mistakes: number; page: number; memorized: boolean }[];
  mastery: number;
  grade: string | null;
  attendance: string;
};

const ATTENDANCE = ['حاضر', 'متأخر', 'غائب', 'غياب المعلمة'];

/** بطاقات آخر التقارير تُقلَّب أفقياً، والنقاط تتبع البطاقة الظاهرة — كبطاقة «درس اليوم» */
export function ReportCarousel({ slides }: { slides: ReportSlide[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  return (
    <div>
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          // في الاتجاه من اليمين لليسار scrollLeft سالب
          setActive(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
        }}
        className="-mx-4 flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s) => (
          <div key={s.id} className="w-full shrink-0 snap-center px-0.5 pb-2 [&:not(:last-child)]:me-3">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">{s.title}</p>
                <span className="text-xs text-muted">{s.date}</span>
              </div>

              <ol className="mt-3 space-y-3">
                {s.segments.map((seg, i) => (
                  <li key={i} className="space-y-2">
                    <Link href={`/guardian/mushaf/${seg.page}`} className="flex items-center gap-2 text-[15px]">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="tabular font-bold text-ink">{i + 1}- </span>
                        <span className="font-semibold text-ink">{seg.label}: </span>
                        <span className="text-muted">{seg.range}</span>
                      </span>
                      <MushafIcon className="size-5 shrink-0 text-gold-text" strokeWidth={1.7} />
                      <ChevronLeft className="size-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                    <div className="flex gap-2">
                      <StatChip tone={seg.memorized ? 'success' : 'warning'} kind={seg.memorized ? 'check' : 'clock'}>
                        {fmtAyahs(seg.ayahs, true)}
                      </StatChip>
                      <StatChip tone={seg.mistakes ? 'danger' : 'success'} kind={seg.mistakes ? 'x' : 'check'}>
                        {seg.mistakes ? `${seg.mistakes} أخطاء` : 'بلا أخطاء'}
                      </StatChip>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-ink">
                  <Star className="size-4 fill-gold text-gold" aria-hidden />
                  الإتقان
                </span>
                <ProgressBar value={s.mastery} label="نسبة الإتقان" />
                <span className="tabular shrink-0 text-sm font-bold text-ink">%{Math.round(s.mastery)}</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label={`الحضور: ${s.attendance}`}>
                {ATTENDANCE.map((a) => (
                  <span
                    key={a}
                    className={cn(
                      'flex h-8 items-center gap-1 rounded-ctl px-2.5 text-xs font-bold',
                      a === s.attendance ? 'border border-brand bg-brand/8 text-brand' : 'text-muted',
                    )}
                  >
                    {a === s.attendance && (
                      <span className="grid size-4 place-items-center rounded-[5px] bg-brand text-on-brand" aria-hidden>
                        <Check className="size-3" strokeWidth={3.5} />
                      </span>
                    )}
                    {a}
                  </span>
                ))}
                <Link href={`/guardian/reports/${s.id}`} className="ms-auto text-xs font-bold text-brand underline-offset-4 hover:underline">
                  التقرير كاملاً
                </Link>
              </div>
            </Card>
          </div>
        ))}
      </div>
      {slides.length > 1 && <Dots count={slides.length} active={active} className="mt-2" />}
    </div>
  );
}
