import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-card bg-card shadow-card', className)} {...props} />;
}

/** بطاقة بشريط ذهبي علوي — نموذج «بطاقة الحصة القادمة» في المواصفات */
export function GoldCard({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('relative overflow-hidden rounded-card bg-card shadow-lift', className)} {...props}>
      <div aria-hidden className="h-1.5 bg-gradient-to-l from-gold via-[#e4c88e] to-gold" />
      {children}
    </div>
  );
}

/** فاصل عناوين الأقسام: خطان ذهبيان قصيران والعنوان بينهما كما حول «لتحفيظ القرآن» */
export function SectionTitle({
  children,
  action,
  className,
  align = 'start',
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  align?: 'start' | 'center';
}) {
  if (align === 'center') {
    return (
      <h2 className={cn('flex items-center justify-center gap-3 text-base font-bold text-ink', className)}>
        <span aria-hidden className="h-px w-7 bg-gold" />
        {children}
        <span aria-hidden className="h-px w-7 bg-gold" />
      </h2>
    );
  }
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <h2 className="flex items-center gap-2.5 text-base font-bold text-ink">
        <span aria-hidden className="h-px w-5 bg-gold" />
        {children}
      </h2>
      <span aria-hidden className="h-px flex-1 bg-line" />
      {action}
    </div>
  );
}

export function Dots({ count, active, className }: { count: number; active: number; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-1.5', className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            'size-2 rounded-full border border-brand/50 transition-all',
            i === active ? 'w-5 border-brand bg-brand' : 'bg-transparent',
          )}
        />
      ))}
    </div>
  );
}

/** سطر بقيمة ونقاط إرشادية كما في تفاصيل الجزء */
export function LeaderRow({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-end gap-2 py-1.5 text-sm', className)}>
      <span className="font-semibold text-ink">{label}</span>
      <span aria-hidden className="leader" />
      <span className="tabular font-semibold text-muted">{value}</span>
    </div>
  );
}
