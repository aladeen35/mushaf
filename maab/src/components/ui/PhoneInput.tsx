'use client';

import { ChevronDown } from 'lucide-react';
import { useMemo, useSyncExternalStore, type ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { getCountryCallingCode } from 'libphonenumber-js';
import { allCountries, FEATURED, type CountryCode } from '@/lib/domain/market';

/** علم الدولة من رمزها (SD ← 🇸🇩) */
export const flag = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

/** الدولة المرجّحة من منطقة الجهاز الزمنية، والسودان افتراضاً */
export function guessCountry(): CountryCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return FEATURED.find((c) => c.tz === tz)?.code ?? 'SD';
  } catch {
    return 'SD';
  }
}

type Props = Omit<ComponentProps<'input'>, 'id' | 'value' | 'onChange'> & {
  id: string;
  label: string;
  country: CountryCode;
  onCountry: (c: CountryCode) => void;
  value: string;
  onValue: (v: string) => void;
  hint?: string;
  error?: string;
};

const subscribe = () => () => {};

/**
 * رقم جوال دولي: الدولة بعلمها ومفتاحها (السودان والسعودية والخليج أولاً)
 * ثم الرقم محلياً أو بمفتاحه، ويُقبل بالأرقام المشرقية.
 */
export function PhoneInput({ id, label, country, onCountry, value, onValue, hint, error, className, ...props }: Props) {
  // أسماء الدول من Intl تختلف بين بيانات الخادم والمتصفح، فتُعرض القائمة في المتصفح فقط
  const client = useSyncExternalStore(subscribe, () => true, () => false);
  const countries = useMemo(() => (client ? allCountries() : []), [client]);
  const dial = `+${getCountryCallingCode(country)}`;
  const featured = countries.filter((c) => c.featured);
  const rest = countries.filter((c) => !c.featured);
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-bold text-ink">
        {label}
      </label>
      <div
        dir="ltr"
        className={cn(
          'flex h-12 overflow-hidden rounded-ctl bg-field ring-1 ring-transparent transition focus-within:bg-card focus-within:ring-gold',
          error && 'bg-card ring-danger focus-within:ring-danger',
        )}
      >
        <span className="relative flex shrink-0 items-center border-e border-line">
          <span aria-hidden className="tabular pointer-events-none flex items-center gap-1.5 ps-3 pe-7 text-[15px] font-semibold text-ink">
            <span className="text-lg leading-none">{flag(country)}</span>
            {dial}
          </span>
          <ChevronDown aria-hidden className="pointer-events-none absolute end-2 size-3.5 text-muted" />
          <select
            aria-label="الدولة"
            value={country}
            onChange={(e) => onCountry(e.target.value as CountryCode)}
            className="absolute inset-0 cursor-pointer opacity-0"
            dir="rtl"
          >
            {!client && (
              <option value={country}>
                {flag(country)} {dial}
              </option>
            )}
            {client && (
              <>
                <optgroup label="الأكثر استعمالاً">
                  {featured.map((c) => (
                    <option key={c.code} value={c.code}>
                      {flag(c.code)} {c.name} ({c.dial})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="كل الدول">
                  {rest.map((c) => (
                    <option key={c.code} value={c.code}>
                      {flag(c.code)} {c.name} ({c.dial})
                    </option>
                  ))}
                </optgroup>
              </>
            )}
          </select>
        </span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          className="tabular w-full bg-transparent px-4 text-[15px] tracking-wide text-ink outline-none placeholder:text-muted/60"
          {...props}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
