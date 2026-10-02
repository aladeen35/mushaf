import type { Metadata } from 'next';
import { PlainShell } from '@/components/shell/PlainShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { ApplicationForm } from './ApplicationForm';

export const metadata: Metadata = { title: 'انضمّي معلمةً' };

export default function Join() {
  return (
    <PlainShell>
      <WaveHeader title="انضمّي معلمةً" back="/">
        <p className="pb-2 text-center text-sm text-on-hero/80">طلب ← مراجعة ← مقابلة تسميع ← قبول</p>
      </WaveHeader>
      <main className="px-4">
        <ApplicationForm />
      </main>
    </PlainShell>
  );
}
