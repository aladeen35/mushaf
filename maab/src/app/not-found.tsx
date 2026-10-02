import { ArchMark } from '@/components/brand/Brand';
import { PlainShell } from '@/components/shell/PlainShell';
import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <PlainShell>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <ArchMark size={64} />
        <h1 className="font-display text-3xl font-bold text-brand">الصفحة غير موجودة</h1>
        <p className="text-sm text-muted">ربما تغيّر الرابط أو انتهت صلاحيته.</p>
        <ButtonLink href="/">العودة للبداية</ButtonLink>
      </main>
    </PlainShell>
  );
}
