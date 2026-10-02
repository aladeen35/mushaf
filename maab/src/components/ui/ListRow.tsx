import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Props = {
  icon: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  meta?: ReactNode;
  href?: string;
  className?: string;
  tone?: 'default' | 'danger';
};

/** سطر قائمة: الأيقونة في البداية والسهم في النهاية، كقائمة الملف الشخصي */
export function ListRow({ icon, label, sub, meta, href, className, tone = 'default' }: Props) {
  const body = (
    <>
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-ctl',
          tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-brand/8 text-brand',
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-semibold', tone === 'danger' ? 'text-danger' : 'text-ink')}>{label}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      {meta && <span className="tabular shrink-0 text-sm text-muted">{meta}</span>}
      {href && <ChevronLeft className="size-4 shrink-0 text-muted" aria-hidden />}
    </>
  );
  const cls = cn(
    'flex min-h-15 items-center gap-3 rounded-card bg-card px-3.5 py-2.5 shadow-card',
    href && 'transition hover:bg-field',
    className,
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
