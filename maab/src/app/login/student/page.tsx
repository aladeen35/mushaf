import type { Metadata } from 'next';
import { LogoFull } from '@/components/brand/Brand';
import { PlainShell } from '@/components/shell/PlainShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { StudentCodeForm } from './StudentCodeForm';

export const metadata: Metadata = { title: 'دخول الطالب' };

export default function StudentLogin() {
  return (
    <PlainShell>
      <WaveHeader back="/login" title="دخول الطالب" curve="arc" className="pb-24" />
      <main className="relative z-10 -mt-20 px-5">
        <div className="flex justify-center">
          <LogoFull size={124} priority />
        </div>
        <h1 className="mt-5 text-center font-display text-[26px] font-bold text-brand">حبابك يا شاطر</h1>
        <p className="mx-auto mt-1 max-w-72 text-center text-sm leading-6 text-muted">
          أدخل الرمز الذي أعطاك إياه ولي أمرك لترى حصتك القادمة وواجب لوحك.
        </p>
        <div className="mt-7 rounded-card bg-card p-5 shadow-card">
          <StudentCodeForm />
        </div>
      </main>
    </PlainShell>
  );
}
