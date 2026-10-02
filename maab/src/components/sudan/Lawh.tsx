import type { ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * الدَّواية وقلم البوص: أداة الكتابة على لوح الخلوة. بخطوط محيطية بسماكة
 * أيقونات Lucide لتنسجم معها.
 */
export function InkwellIcon({ strokeWidth = 2, ...props }: SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M6.5 12.5h9l-.9 6.4a2 2 0 0 1-2 1.6h-3.2a2 2 0 0 1-2-1.6z" />
      <path d="M8.5 12.5V10h5v2.5" />
      <path d="M7.5 10h7" />
      <path d="m12.5 10 6.5-7.5" />
      <path d="m19 2.5 1.2.9-.6 1.5" />
    </svg>
  );
}

/** رأس اللوح المستدير بثقبه، كما يُعلَّق اللوح في الخلوة */
function Head({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('lawh relative z-0 mx-auto -mb-3 grid h-9 w-20 place-items-center rounded-t-full pt-1 shadow-none', className)}>
      <span className="size-2.5 rounded-full bg-page shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)]" />
    </div>
  );
}

type LawhProps = {
  /** عنوان صغير أعلى اللوح: «لوح اليوم» */
  label?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * لوح الخلوة: الواجب يُكتب على لوح خشبي كما يكتب الحِيران ما يحفظونه
 * في الخلاوي السودانية. يُستعمل لواجب الحصة القادمة فقط، لا لكل البطاقات.
 */
export function Lawh({ label, children, footer, className }: LawhProps) {
  return (
    <div className={cn('relative', className)}>
      <Head />
      <div className="lawh relative z-10 rounded-[20px] px-5 pt-4 pb-4">
        {label && (
          <p className="flex items-center gap-2 text-xs font-bold opacity-75">
            <InkwellIcon className="size-4" />
            {label}
          </p>
        )}
        <div className="mt-2 font-display">{children}</div>
        {footer && <div className="mt-3 border-t border-wood-edge/30 pt-3 text-xs">{footer}</div>}
      </div>
    </div>
  );
}

/** سطر على اللوح بخط النسخ: «حفظ: المدثر 32–56» */
export function LawhLine({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <p className="flex items-baseline gap-2 py-0.5 text-[19px] leading-9">
      <span className="text-sm font-bold opacity-70">{kind}:</span>
      <span className="font-bold">{children}</span>
    </p>
  );
}
