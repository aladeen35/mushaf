import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoFull } from '@/components/brand/Brand';
import { PlainShell } from '@/components/shell/PlainShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { LoginFlow } from './LoginFlow';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default function Login() {
  return (
    <PlainShell>
      <WaveHeader back="/" title="تسجيل الدخول" curve="arc" className="pb-24" />
      <main className="relative z-10 -mt-20 px-5 pb-10">
        <div className="flex justify-center">
          <LogoFull size={124} priority />
        </div>
        <h1 className="mt-5 text-center font-display text-[26px] font-bold text-brand">حبابك في مآب</h1>
        <p className="mx-auto mt-1 max-w-72 text-center text-sm leading-6 text-muted">ادخلي برقم جوالك من أي بلد، ولا حاجة لكلمة مرور.</p>

        <div className="mt-6 rounded-card bg-card p-5 shadow-card">
          <LoginFlow />
        </div>

        <p className="mt-5 text-center text-sm">
          <Link href="/login/student" className="font-bold text-brand underline-offset-4 hover:underline">
            دخول الطالب برمز من ولي أمره
          </Link>
        </p>
        <p className="mt-4 text-center text-xs leading-6 text-muted">
          بالمتابعة توافقين على{' '}
          <Link href="/legal/terms" className="font-semibold text-brand underline">
            الشروط والأحكام
          </Link>{' '}
          و
          <Link href="/legal/privacy" className="font-semibold text-brand underline">
            سياسة الخصوصية
          </Link>
          .
        </p>
      </main>
    </PlainShell>
  );
}
