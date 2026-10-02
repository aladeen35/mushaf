'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

type Option<T extends string> = { value: T; label: string; disabled?: boolean };

/**
 * اختيار واحد بأقراص متجاورة — كأزرار الحضور في بطاقة الحصة.
 * يُبنى على أزرار راديو حقيقية ليعمل بلوحة المفاتيح وقارئ الشاشة.
 */
export function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  className,
}: {
  name: string;
  legend: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                'flex h-9 cursor-pointer items-center gap-1.5 rounded-ctl border px-3 text-xs font-bold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold',
                on ? 'border-brand bg-brand/8 text-brand' : 'border-transparent bg-field text-muted hover:text-ink',
                o.disabled && 'pointer-events-none opacity-40',
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={o.value}
                checked={on}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
              />
              {on && (
                <span className="grid size-4 place-items-center rounded-[5px] bg-brand text-on-brand" aria-hidden>
                  <Check className="size-3" strokeWidth={3.5} />
                </span>
              )}
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** أقراص أيام بإطار مستدير، يُختار منها أكثر من يوم — كأيام الحلقة */
export function DayPills<T extends string>({
  legend,
  options,
  value,
  onChange,
  className,
}: {
  legend: string;
  options: Option<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  className?: string;
}) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="mb-3 text-sm font-bold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <label
              key={o.value}
              className={cn(
                'flex h-9 min-w-19 cursor-pointer items-center justify-center rounded-full border-[1.5px] px-4 text-sm font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold',
                on ? 'border-brand bg-brand text-on-brand' : 'border-brand/35 text-ink hover:border-brand',
                o.disabled && 'pointer-events-none border-line text-muted/50',
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                disabled={o.disabled}
                onChange={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** اختيار واحد بأقراص مستديرة (مدة الحصة، الفترة) */
export function PillRadio<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  className,
}: {
  name: string;
  legend: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      <legend className="mb-3 text-sm font-bold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                'flex h-9 cursor-pointer items-center justify-center rounded-full border-[1.5px] px-4 text-sm font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold',
                on ? 'border-brand bg-brand text-on-brand' : 'border-brand/35 text-ink hover:border-brand',
                o.disabled && 'pointer-events-none border-line text-muted/50',
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={on}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
