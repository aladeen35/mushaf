import { LoaderCircle, ShieldCheck, Video } from 'lucide-react';
import type { Metadata } from 'next';
import { LogoFull } from '@/components/brand/Brand';
import { PlainShell } from '@/components/shell/PlainShell';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'الدخول للحصة' };

/**
 * زر «ادخل الحصة» يمرّ بالمنصة أولاً فيُسجَّل وقت الضغط (إثبات الحضور دون
 * تقارير Meet)، ثم يُحوَّل إلى رابط الحصة. الرابط لا يُرسل خارج المنصة (القسم 8).
 */
export default async function JoinSession({ params }: PageProps<'/sessions/[id]/join'>) {
  const { id } = await params;
  return (
    <PlainShell>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <LogoFull size={120} />
        <div className="space-y-2">
          <p className="flex items-center justify-center gap-2 text-lg font-bold text-ink">
            <LoaderCircle className="size-5 animate-spin text-gold-text" aria-hidden />
            جارٍ تسجيل وقت دخولك
          </p>
          <p className="text-sm leading-6 text-muted">ثم نحوّلك إلى Google Meet. في نسخة العرض لا يُفتح رابط فعلي.</p>
        </div>
        <ul className="w-full max-w-xs space-y-2 text-start text-sm text-ink">
          <li className="flex items-center gap-2 rounded-ctl bg-card p-3 shadow-card">
            <ShieldCheck className="size-5 shrink-0 text-success" aria-hidden />
            الحصص لا تُسجَّل، والكاميرا اختيارية للطالبة
          </li>
          <li className="flex items-center gap-2 rounded-ctl bg-card p-3 shadow-card">
            <Video className="size-5 shrink-0 text-gold-text" aria-hidden />
            رمز الحصة: <span dir="ltr" className="tabular font-mono font-bold">{id}</span>
          </li>
        </ul>
        <ButtonLink href="/guardian" variant="secondary">
          العودة
        </ButtonLink>
      </main>
    </PlainShell>
  );
}
