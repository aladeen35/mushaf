import { BadgeCheck, ClipboardCheck, Video } from 'lucide-react';
import Link from 'next/link';
import { LogoFull } from '@/components/brand/Brand';
import { ButtonLink } from '@/components/ui/Button';

const points = [
  { icon: BadgeCheck, text: 'معلمات مجازات، وبيئة نسائية خاصة' },
  { icon: Video, text: 'حصص مباشرة فردية في أوقاتكم' },
  { icon: ClipboardCheck, text: 'تقرير حفظ ومراجعة بعد كل حصة' },
];

export default function Welcome() {
  return (
    <div className="min-h-dvh md:bg-sunken">
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden bg-page md:shadow-[0_0_60px_-30px_rgb(var(--shadow-ink)/0.5)]">
        <section className="flex flex-1 flex-col items-center justify-center px-6 pt-14 pb-10 text-center">
          <LogoFull size={176} priority />
          <h1 className="mt-7 font-display text-[32px] leading-tight font-bold text-brand">أكاديمية مآب</h1>
          <p className="mt-1 flex items-center gap-3 text-sm font-semibold text-gold-text">
            <span aria-hidden className="h-px w-6 bg-gold" />
            لتحفيظ القرآن الكريم عن بُعد
            <span aria-hidden className="h-px w-6 bg-gold" />
          </p>
          <p className="mt-4 max-w-72 text-[15px] leading-7 text-muted">للأطفال والنساء، بمعلمات فقط، ومتابعة لولي الأمر خطوةً بخطوة.</p>
        </section>

        <section className="maab-hero relative isolate px-6 pt-20 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div aria-hidden className="maab-pattern absolute inset-0 -z-10" />
          <svg aria-hidden className="absolute inset-x-0 -top-px h-16 w-full" viewBox="0 0 400 64" preserveAspectRatio="none">
            <path d="M0 0h400v18C300 70 140 64 0 30z" fill="var(--surface-page)" />
            <path d="M400 18C300 70 140 64 0 30" fill="none" stroke="var(--brand-gold)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>

          <ul className="space-y-3">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px]">
                <span className="grid size-9 place-items-center rounded-ctl bg-white/10 text-gold">
                  <Icon className="size-[18px]" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <ButtonLink href="/login" variant="hero" size="lg" block className="mt-8">
            ابدأ برقم الجوال
          </ButtonLink>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link href="/login?as=student" className="font-semibold text-on-hero/90 underline-offset-4 hover:underline">
              دخول الطالب برمز
            </Link>
            <Link href="/join" className="font-semibold text-gold underline-offset-4 hover:underline">
              انضمّي معلمةً
            </Link>
          </div>

          <nav aria-label="استعراض الواجهات" className="mt-7 border-t border-white/12 pt-4">
            <p className="text-center text-[11px] text-on-hero/60">نسخة العرض — استعراض الواجهات</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-bold">
              <Link href="/guardian" className="rounded-ctl bg-white/8 py-2 hover:bg-white/14">ولي الأمر</Link>
              <Link href="/teacher" className="rounded-ctl bg-white/8 py-2 hover:bg-white/14">المعلمة</Link>
              <Link href="/admin" className="rounded-ctl bg-white/8 py-2 hover:bg-white/14">الإدارة</Link>
            </div>
          </nav>
        </section>
      </div>
    </div>
  );
}
