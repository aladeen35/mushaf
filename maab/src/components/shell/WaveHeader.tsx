import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// حافة الرأس المنحنية من المرجع، يتبعها خيط ذهبي كإطار القوس في الشعار.
const curves = {
  swoosh: { fill: 'M0 56V30C96 62 214 2 400 20v36z', line: 'M0 30C96 62 214 2 400 20' },
  arc: { fill: 'M0 56V8c70 40 150 46 200 46s130-6 200-46v48z', line: 'M0 8c70 40 150 46 200 46s130-6 200-46' },
  tilt: { fill: 'M0 56V44C120 40 260 22 400 0v56z', line: 'M0 44C120 40 260 22 400 0' },
} as const;

type Props = {
  title?: ReactNode;
  /** رابط الرجوع — السهم في جهة البداية (اليمين) */
  back?: string;
  start?: ReactNode;
  end?: ReactNode;
  children?: ReactNode;
  curve?: keyof typeof curves;
  className?: string;
  /** مسافة إضافية أسفل الرأس لبطاقة تتداخل معه */
  overlap?: boolean;
};

export function WaveHeader({ title, back, start, end, children, curve = 'swoosh', className, overlap }: Props) {
  const c = curves[curve];
  return (
    <header className={cn('maab-hero relative isolate overflow-hidden', overlap ? 'pb-24' : 'pb-14', className)}>
      <div aria-hidden className="maab-pattern absolute inset-0 -z-10" />
      <div className="relative px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="grid h-14 grid-cols-[minmax(3rem,auto)_1fr_minmax(3rem,auto)] items-center gap-2">
          <div className="flex justify-start">
            {back ? (
              <Link
                href={back}
                aria-label="رجوع"
                className="-ms-2 grid size-10 place-items-center rounded-full text-on-hero/90 hover:bg-white/10"
              >
                <ChevronRight className="size-6" />
              </Link>
            ) : (
              start
            )}
          </div>
          <div className="truncate text-center text-lg font-bold">{title}</div>
          <div className="flex justify-end">{end}</div>
        </div>
        {children}
      </div>
      <svg aria-hidden className="absolute inset-x-0 -bottom-px h-14 w-full" viewBox="0 0 400 56" preserveAspectRatio="none">
        <path d={c.fill} fill="var(--surface-page)" />
        <path d={c.line} fill="none" stroke="var(--brand-gold)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".9" />
      </svg>
    </header>
  );
}

export function HeaderIconButton({
  href,
  label,
  children,
  badge,
}: {
  href: string;
  label: string;
  children: ReactNode;
  badge?: number;
}) {
  return (
    <Link href={href} aria-label={label} className="relative grid size-10 place-items-center rounded-full text-on-hero hover:bg-white/10">
      {children}
      {badge ? (
        <span className="tabular absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-brand-deep">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
