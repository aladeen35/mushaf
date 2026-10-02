import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * إطار الشرافة: حين يختم الحُوار جزءاً في الخلوة يُزيَّن لوحه بالألوان
 * ويُحتفل به. الإطار مثلثات بألوان البيوت النوبية: أخضر مآب وذهبه، والنيلي
 * والطوبي، على سطح اللوح الطيني.
 */
function Frame() {
  const colors = ['var(--brand-green)', 'var(--brand-gold)', 'var(--nubian-blue)', 'var(--nubian-red)'];
  const row = (y: number, flip: boolean) =>
    Array.from({ length: 20 }, (_, i) => {
      const x = i * 10;
      const d = flip ? `M${x} ${y} L${x + 5} ${y + 7} L${x + 10} ${y} Z` : `M${x} ${y + 7} L${x + 5} ${y} L${x + 10} ${y + 7} Z`;
      return <path key={`${y}-${i}`} d={d} fill={colors[i % colors.length]} />;
    });
  return (
    <svg aria-hidden viewBox="0 0 200 7" preserveAspectRatio="none" className="h-2.5 w-full">
      {row(0, false)}
    </svg>
  );
}

type Props = {
  /** «الجزء الثلاثون (عمّ)» */
  juz: string;
  student: string;
  /** المؤنث للطالبة: «أتمّت» */
  female: boolean;
  children?: ReactNode;
  className?: string;
};

export function SharafaCard({ juz, student, female, children, className }: Props) {
  return (
    <section aria-label="شرافة" className={cn('lawh overflow-hidden rounded-[20px]', className)}>
      <Frame />
      <div className="px-5 py-4 text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs font-bold tracking-wide opacity-75">
          <Sparkles className="size-3.5" aria-hidden />
          شرافة
        </p>
        <p className="mt-1 font-display text-2xl leading-10 font-bold">مبروك الشرافة</p>
        <p className="mt-1 text-sm leading-7">
          {female ? 'أتمّت' : 'أتمّ'} {student} حفظ <b>{juz}</b>، ربنا {female ? 'يبارك فيها' : 'يبارك فيه'} ويجعله في ميزان حسناتكم.
        </p>
        {children && <div className="mt-3">{children}</div>}
      </div>
      <div className="rotate-180">
        <Frame />
      </div>
    </section>
  );
}
