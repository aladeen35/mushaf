import { Check, Clock, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// شارات الحالة: خلفية فاتحة من لون الحالة ونص بلونها الداكن (القسم 16).
const tones = {
  success: 'bg-success/12 text-success',
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/14 text-warning',
  gold: 'bg-gold/16 text-gold-text',
  brand: 'bg-brand/10 text-brand',
  neutral: 'bg-sunken text-muted',
} as const;

export type Tone = keyof typeof tones;

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** مؤشر بمربع صغير كما في شرائح «وجه» و«خطأ» */
export function BoxIcon({ kind }: { kind: 'check' | 'x' | 'clock' }) {
  const Icon = kind === 'check' ? Check : kind === 'x' ? X : Clock;
  return (
    <span className="grid size-4 place-items-center rounded-[5px] border-[1.5px] border-current">
      <Icon className="size-2.5" strokeWidth={3.5} />
    </span>
  );
}

/** شريحة إحصاء ممتدة داخل البطاقات: قيمة بارزة مع أيقونة مربعة */
export function StatChip({ tone, kind, children }: { tone: Tone; kind: 'check' | 'x' | 'clock'; children: ReactNode }) {
  return (
    <span className={cn('flex h-9 flex-1 items-center justify-center gap-2 rounded-ctl text-sm font-bold', tones[tone])}>
      <BoxIcon kind={kind} />
      <span className="tabular">{children}</span>
    </span>
  );
}
