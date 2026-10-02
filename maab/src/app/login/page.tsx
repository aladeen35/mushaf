import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoFull } from '@/components/brand/Brand';
import { PlainShell } from '@/components/shell/PlainShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default async function Login({ searchParams }: PageProps<'/login'>) {
  const asStudent = (await searchParams).as === 'student';
  return (
    <PlainShell>
      <WaveHeader back="/" title={asStudent ? 'دخول الطالب' : 'تسجيل الدخول'} curve="arc" className="pb-24" />
      <main className="relative z-10 -mt-20 px-5">
        <div className="flex justify-center">
          <LogoFull size={124} priority />
        </div>
        <h1 className="mt-5 text-center text-2xl font-bold text-ink">{asStudent ? 'أهلًا بك' : 'أهلًا بكِ في مآب'}</h1>
        <p className="mx-auto mt-2 max-w-72 text-center text-sm leading-6 text-muted">
          {asStudent
            ? 'أدخل الرمز الذي أعطاك إياه ولي أمرك لترى حصتك القادمة وورد اليوم.'
            : 'سجّلي برقم جوالك، ولا حاجة لكلمة مرور.'}
        </p>

        <div className="mt-7 rounded-card bg-card p-5 shadow-card">
          <LoginForm asStudent={asStudent} />
        </div>

        {!asStudent && (
          <>
            <div className="my-6 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              أو
              <span className="h-px flex-1 bg-line" />
            </div>
            <Link
              href="/onboarding"
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-ctl border border-line bg-card text-[15px] font-bold text-ink shadow-card hover:bg-field"
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
                <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z" />
                <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.4 9.1 5.4 12 5.4z" />
              </svg>
              المتابعة بحساب Google
            </Link>
            <p className="mt-6 text-center text-xs leading-6 text-muted">
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
          </>
        )}
      </main>
    </PlainShell>
  );
}
