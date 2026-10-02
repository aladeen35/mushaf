import { MessageSquareText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PlainShell } from '@/components/shell/PlainShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { OtpForm } from './OtpForm';

export const metadata: Metadata = { title: 'رمز التحقق' };

export default async function Verify({ searchParams }: PageProps<'/login/verify'>) {
  const raw = (await searchParams).phone;
  const phone = typeof raw === 'string' && /^5\d{8}$/.test(raw) ? raw : '512345678';
  const display = `+966 ${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5)}`;
  return (
    <PlainShell>
      <WaveHeader back="/login" title="رمز التحقق" curve="arc" className="pb-24" />
      <main className="relative z-10 -mt-16 px-5">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-card text-gold-text shadow-lift">
          <MessageSquareText className="size-9" strokeWidth={1.6} aria-hidden />
        </div>
        <h1 className="mt-5 text-center text-xl font-bold text-ink">أدخلي الرمز المرسل إلى جوالك</h1>
        <p className="mt-2 text-center text-sm text-muted">
          أرسلنا رمزًا من ستة أرقام إلى{' '}
          <bdi dir="ltr" className="tabular font-bold text-ink">
            {display}
          </bdi>
          {' · '}
          <Link href="/login" className="font-semibold text-brand underline">
            تغيير الرقم
          </Link>
        </p>
        <div className="mt-7 rounded-card bg-card p-5 shadow-card">
          <OtpForm phone={display} />
        </div>
        <p className="mt-5 text-center text-xs text-muted">نسخة العرض: أي رمز يُقبل عدا 000000.</p>
      </main>
    </PlainShell>
  );
}
