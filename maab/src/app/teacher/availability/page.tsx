import type { Metadata } from 'next';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { AvailabilityEditor } from './AvailabilityEditor';

export const metadata: Metadata = { title: 'أوقاتي' };

// فترات الإتاحة بتوقيت الرياض بصيغة 24 ساعة (تُخزَّن UTC في teacher_availability)
const INITIAL = [
  { key: 'sat', day: 'السبت', windows: [{ from: '10:00', to: '14:00' }] },
  { key: 'sun', day: 'الأحد', windows: [{ from: '13:00', to: '21:00' }] },
  { key: 'mon', day: 'الاثنين', windows: [{ from: '16:00', to: '20:00' }] },
  { key: 'tue', day: 'الثلاثاء', windows: [{ from: '13:00', to: '21:00' }] },
  { key: 'wed', day: 'الأربعاء', windows: [] },
  { key: 'thu', day: 'الخميس', windows: [{ from: '16:00', to: '21:00' }] },
  { key: 'fri', day: 'الجمعة', windows: [] },
];

export default function Availability() {
  return (
    <>
      <WaveHeader title="أوقات الإتاحة" back="/teacher" />
      <Page className="-mt-4">
        <AvailabilityEditor initial={INITIAL} />
      </Page>
    </>
  );
}
