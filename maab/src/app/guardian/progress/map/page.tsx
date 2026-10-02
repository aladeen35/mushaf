import { Check, ChevronDown, Minus, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChildPanels, ChildTabs } from '@/components/features/ChildTabs';
import { ProgressTabs } from '@/components/features/ProgressTabs';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { SharafaCard } from '@/components/sudan/Sharafa';
import { Card, LeaderRow } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { cn } from '@/lib/cn';
import { dataset, type Dataset } from '@/lib/data';
import type { JuzStatus } from '@/lib/progress';
import type { Student } from '@/lib/types';
import { surah } from '@/lib/quran';
import { JUZ_NAMES, juzOrdinal } from '@/lib/quran/names';

export const metadata: Metadata = { title: 'خريطة الحفظ' };

// الأجزاء المحفوظة بالأخضر، وقيد الحفظ بالذهبي، وما لم يبدأ رمادي فاتح (القسم 16)
const STATUS: Record<JuzStatus, { label: string; cell: string }> = {
  memorized: { label: 'محفوظ', cell: 'bg-brand text-on-brand' },
  in_progress: { label: 'قيد الحفظ', cell: 'bg-gold text-brand-deep' },
  not_started: { label: 'لم يبدأ', cell: 'bg-sunken text-muted' },
};

export default async function MemorizationMap() {
  const d = await dataset('guardian');
  const kids = d.childrenOf();
  return (
    <>
      <WaveHeader title="خريطة الحفظ" back="/guardian" curve="tilt">
        {kids.length > 0 && <ChildPanels panels={Object.fromEntries(kids.map((k) => [k.id, <MapHeader key={k.id} d={d} child={k} />]))} />}
        <ChildTabs items={kids} base="/guardian/progress/map" />
      </WaveHeader>
      <Page className="-mt-4">
        {kids.length ? (
          <ChildPanels panels={Object.fromEntries(kids.map((k) => [k.id, <ChildMap key={k.id} d={d} child={k} />]))} />
        ) : (
          <Card className="p-4 text-sm text-muted">أضيفي ابنكِ أولاً لتظهر خريطة حفظه.</Card>
        )}
      </Page>
    </>
  );
}

function MapHeader({ d, child }: { d: Dataset; child: Student }) {
  const teacher = d.getTeacher(child.teacherId);
  return (
    <div className="space-y-1 pt-1 pb-3 text-sm">
      <p className="text-lg font-bold">خطة {child.name}</p>
      <p className="text-on-hero/80">{child.plan.direction === 'nas_to_baqarah' ? 'من سورة الناس إلى البقرة' : 'من البقرة إلى الناس'}</p>
      <p className="text-on-hero/80">
        المعلمة: {teacher.name} · الهدف <span className="tabular">{child.plan.weeklyTarget}</span> آية أسبوعيًا
      </p>
    </div>
  );
}

function ChildMap({ d, child }: { d: Dataset; child: Student }) {
  const juz = d.juzProgress(child);
  const ordered = child.plan.direction === 'nas_to_baqarah' ? [...juz].reverse() : juz;
  const done = ordered.filter((j) => j.status === 'memorized');
  // آخر جزء أُتمّ في اتجاه الخطة هو صاحب الشرافة
  const latest = done.at(-1);
  return (
    <div className="space-y-6">
      <ProgressTabs active="map" child={child.id} />

      {latest && (
        <SharafaCard
          juz={`${juzOrdinal(latest.juz)} (${JUZ_NAMES[latest.juz - 1]})`}
          student={child.name}
          female={child.gender === 'female'}
        >
          {done.length > 1 && <p className="text-xs opacity-75">شرافات {child.name}: {done.length} أجزاء مكتملة</p>}
        </SharafaCard>
      )}

      <Card className="p-4">
        <ol className="grid grid-cols-6 gap-1.5" aria-label="أجزاء المصحف">
          {juz.map((j) => (
            <li
              key={j.juz}
              title={`${juzOrdinal(j.juz)}: ${STATUS[j.status].label}`}
              className={cn('tabular relative grid aspect-square place-items-center overflow-hidden rounded-lg text-sm font-bold', STATUS[j.status].cell)}
            >
              {j.status === 'in_progress' && (
                <span aria-hidden className="absolute inset-x-0 bottom-0 bg-brand/25" style={{ height: `${j.percent}%` }} />
              )}
              {j.status === 'memorized' && <Sparkles aria-hidden className="absolute end-0.5 top-0.5 size-2.5 text-gold" />}
              <span className="relative">{j.juz}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex justify-center gap-4 text-xs text-muted">
          {(Object.keys(STATUS) as JuzStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span aria-hidden className={cn('size-3 rounded-[4px]', STATUS[s].cell)} />
              {STATUS[s].label}
            </span>
          ))}
        </div>
      </Card>

      <div className="space-y-2.5">
        {ordered.map((j) => {
          const first = surah(j.from.surah);
          const last = surah(j.to.surah);
          return (
            <details
              key={j.juz}
              name="juz"
              open={j.status === 'in_progress'}
              className="group overflow-hidden rounded-card bg-card shadow-card open:shadow-lift"
            >
              <summary className="flex h-14 cursor-pointer list-none items-center gap-3 px-4 transition group-open:bg-brand group-open:text-on-brand [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-md border-[1.5px]',
                    j.status === 'memorized' && 'border-brand bg-brand text-on-brand group-open:border-gold group-open:bg-gold group-open:text-brand-deep',
                    j.status === 'in_progress' && 'border-gold text-gold-text group-open:text-gold',
                    j.status === 'not_started' && 'border-line group-open:border-on-brand/40',
                  )}
                >
                  {j.status === 'memorized' && <Check className="size-4" strokeWidth={3} />}
                  {j.status === 'in_progress' && <Minus className="size-4" strokeWidth={3} />}
                </span>
                <span className="flex-1 font-bold">{juzOrdinal(j.juz)}</span>
                <span className="sr-only">{STATUS[j.status].label}</span>
                {j.status !== 'not_started' && <span className="tabular text-sm font-semibold opacity-80">%{j.percent}</span>}
                <ChevronDown className="size-5 shrink-0 opacity-70 transition group-open:rotate-180" aria-hidden />
              </summary>
              <div className="space-y-3 px-4 pt-4 pb-4">
                <div className="text-center">
                  <p className="font-display text-xl font-bold text-ink">جزء {JUZ_NAMES[j.juz - 1]}</p>
                  {j.status === 'memorized' && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-gold/14 px-2.5 py-0.5 text-xs font-bold text-gold-text">
                      <Sparkles className="size-3" aria-hidden />
                      شرافة
                    </p>
                  )}
                  <p className="text-sm text-muted">
                    سورة {first.name} {j.from.ayah} / سورة {last.name} {j.to.ayah}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-sm font-bold text-ink">نسبة التقدّم</span>
                  <ProgressBar value={j.percent} label={`تقدّم ${juzOrdinal(j.juz)}`} />
                  <span className="tabular shrink-0 text-sm font-bold text-ink">%{j.percent}</span>
                </div>
                <div>
                  <LeaderRow label="الآيات المحفوظة" value={`${j.memorizedAyahs} من ${j.ayahs}`} />
                  <LeaderRow label="عدد السور" value={j.surahs.length} />
                  <LeaderRow label="عدد الصفحات" value={j.pages} />
                  <LeaderRow label="عدد الآيات" value={j.ayahs} />
                  <LeaderRow label="الصفحات" value={`${j.startPage}–${j.endPage}`} />
                </div>
                <Link
                  href={`/guardian/mushaf/${j.startPage}`}
                  className="block rounded-ctl border border-gold py-2.5 text-center text-sm font-bold text-brand hover:bg-gold/10"
                >
                  افتح الجزء في المصحف
                </Link>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
