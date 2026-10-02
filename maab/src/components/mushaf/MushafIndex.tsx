import Link from 'next/link';
import { ParamPanels, ParamTabs } from '@/components/features/ParamPanels';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card } from '@/components/ui/Card';
import { fmtAyahs } from '@/lib/format';
import { JUZ, SURAHS, surah } from '@/lib/quran';
import { JUZ_NAMES, juzOrdinal } from '@/lib/quran/names';
import { MushafSearch } from './MushafSearch';
import { ContinueReading } from './ReadingMemory';

/** رقم السورة داخل نجمة ثمانية بإطار ذهبي */
function Number8({ n }: { n: number }) {
  return (
    <span className="relative grid size-10 shrink-0 place-items-center text-brand" aria-hidden>
      <svg viewBox="0 0 40 40" className="absolute inset-0">
        <path d="M20 2l5.3 5.6 7.4.3.3 7.4L38 20l-5 4.7-.3 7.4-7.4.3L20 38l-5.3-5.6-7.4-.3-.3-7.4L2 20l5-4.7.3-7.4 7.4-.3z" fill="var(--surface-card)" stroke="var(--brand-gold)" strokeWidth="1.5" />
      </svg>
      <span className="tabular relative text-xs font-bold">{n}</span>
    </span>
  );
}

export function MushafIndex({ base, wirdPage }: { base: string; wirdPage: number }) {
  const surahList = (
    <Card className="divide-y divide-line">
      {SURAHS.map((s) => (
        <Link key={s.id} href={`${base}/${s.startPage}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-field">
          <Number8 n={s.id} />
          <span className="flex-1">
            <span className="block font-display text-lg leading-tight font-bold text-ink">{s.name}</span>
            <span className="text-xs text-muted">
              {s.place} · {fmtAyahs(s.ayahs)}
            </span>
          </span>
          <span className="tabular text-xs text-muted">ص {s.startPage}</span>
        </Link>
      ))}
    </Card>
  );
  const juzList = (
    <Card className="divide-y divide-line">
      {JUZ.map((j) => (
        <Link key={j.juz} href={`${base}/${j.page}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-field">
          <Number8 n={j.juz} />
          <span className="flex-1">
            <span className="block font-bold text-ink">{juzOrdinal(j.juz)}</span>
            <span className="text-xs text-muted">
              {JUZ_NAMES[j.juz - 1]} · من {surah(j.surah).name} {j.ayah}
            </span>
          </span>
          <span className="tabular text-xs text-muted">ص {j.page}</span>
        </Link>
      ))}
    </Card>
  );
  return (
    <>
      <WaveHeader title="المصحف" className="pb-20">
        <p className="pb-1 text-center text-sm text-on-hero/80">مصحف المدينة النبوية · رواية حفص عن عاصم</p>
      </WaveHeader>
      <main className="relative z-10 -mt-14 space-y-4 px-4">
        <MushafSearch base={base} />
        <ContinueReading base={base} fallback={wirdPage} />
        <ParamTabs
          param="tab"
          label="الفهرس"
          tabs={[
            { key: 'surahs', label: 'السور', href: base },
            { key: 'juz', label: 'الأجزاء', href: `${base}?tab=juz` },
          ]}
        />
        <ParamPanels param="tab" panels={{ surahs: surahList, juz: juzList }} />
      </main>
    </>
  );
}
