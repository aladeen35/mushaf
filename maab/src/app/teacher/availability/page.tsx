import type { Metadata } from 'next';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { dataset } from '@/lib/data';
import { timezoneLabel } from '@/lib/domain/market';
import { AvailabilityEditor } from './AvailabilityEditor';

export const metadata: Metadata = { title: 'أوقاتي' };

// أيام الأسبوع بدءاً بالسبت، ومفاتيحها برقم اليوم (0 = الأحد) كما في القاعدة
const DAYS = [
  { key: 'sat', weekday: 6, day: 'السبت' },
  { key: 'sun', weekday: 0, day: 'الأحد' },
  { key: 'mon', weekday: 1, day: 'الاثنين' },
  { key: 'tue', weekday: 2, day: 'الثلاثاء' },
  { key: 'wed', weekday: 3, day: 'الأربعاء' },
  { key: 'thu', weekday: 4, day: 'الخميس' },
  { key: 'fri', weekday: 5, day: 'الجمعة' },
];

export default async function Availability() {
  const d = await dataset('teacher');
  const av = d.availability ?? { timezone: d.guardian.timezone, windows: [] };
  const initial = DAYS.map((x) => ({
    ...x,
    windows: av.windows.filter((w) => w.weekday === x.weekday).map((w) => ({ from: w.start, to: w.end })),
  }));
  return (
    <>
      <WaveHeader title="أوقات الإتاحة" back="/teacher">
        <p className="pb-2 text-center text-sm text-on-hero/80">بتوقيت {timezoneLabel(av.timezone)}</p>
      </WaveHeader>
      <Page className="-mt-4">
        <AvailabilityEditor teacherId={d.me?.id ?? ''} initial={initial} />
      </Page>
    </>
  );
}
