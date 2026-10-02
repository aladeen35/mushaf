import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

// الزر الأساسي أخضر بنص كريمي، والثانوي إطار ذهبي بنص أخضر (القسم 16).
const variants = {
  primary:
    'bg-brand text-on-brand shadow-[0_8px_18px_-10px_rgb(var(--shadow-ink)/0.7)] hover:bg-brand-soft active:translate-y-px',
  secondary: 'border border-gold text-brand bg-transparent hover:bg-gold/10',
  soft: 'bg-brand/8 text-brand hover:bg-brand/14',
  ghost: 'text-brand hover:bg-brand/8',
  hero: 'bg-card text-brand shadow-[0_10px_24px_-14px_rgb(0_0_0/0.6)] hover:bg-page dark:bg-brand dark:text-on-brand dark:hover:bg-brand-soft',
  success: 'bg-success/12 text-success hover:bg-success/18',
  danger: 'bg-danger/10 text-danger hover:bg-danger/16',
} as const;

const sizes = {
  lg: 'h-13 px-6 text-base',
  md: 'h-12 px-5 text-[15px]',
  sm: 'h-10 px-4 text-sm',
  xs: 'h-8 px-3 text-xs',
} as const;

type Style = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  block?: boolean;
};

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-ctl font-bold transition-colors disabled:pointer-events-none disabled:opacity-50';

export function buttonClass({ variant = 'primary', size = 'md', block }: Style, className?: string) {
  return cn(base, variants[variant], sizes[size], block && 'w-full', className);
}

export function Button({ variant, size, block, className, type = 'button', ...props }: ComponentProps<'button'> & Style) {
  return <button type={type} className={buttonClass({ variant, size, block }, className)} {...props} />;
}

export function ButtonLink({ variant, size, block, className, ...props }: ComponentProps<typeof Link> & Style) {
  return <Link className={buttonClass({ variant, size, block }, className)} {...props} />;
}
