import type { Metadata } from 'next';
import { PlainShell } from '@/components/shell/PlainShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { OnboardingForm } from './OnboardingForm';

export const metadata: Metadata = { title: 'إكمال الحساب' };

export default function Onboarding() {
  return (
    <PlainShell>
      <WaveHeader back="/login/verify" title="إكمال الحساب">
        <p className="pb-2 text-center text-sm text-on-hero/80">خطوة أخيرة قبل اختيار المعلمة والأوقات</p>
      </WaveHeader>
      <main className="px-5">
        <ol className="mb-5 flex items-center justify-center gap-2 text-[11px] font-bold" aria-label="مراحل التسجيل">
          {['الجوال', 'الحساب', 'الطالب', 'الباقة'].map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={i <= 1 ? 'text-brand' : 'text-muted'}>
                <span className={`tabular me-1 inline-grid size-5 place-items-center rounded-full ${i <= 1 ? 'bg-brand text-on-brand' : 'bg-sunken'}`}>
                  {i + 1}
                </span>
                {s}
              </span>
              {i < 3 && <span aria-hidden className="h-px w-4 bg-line" />}
            </li>
          ))}
        </ol>
        <OnboardingForm />
      </main>
    </PlainShell>
  );
}
