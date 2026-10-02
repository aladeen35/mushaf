import { CircleAlert } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const control =
  'h-12 w-full rounded-ctl bg-field px-4 text-[15px] text-ink placeholder:text-muted/70 outline-none ring-1 ring-transparent transition focus:bg-card focus:ring-gold';

type FieldShell = {
  label: string;
  hint?: ReactNode;
  error?: string;
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
  htmlFor: string;
};

function FieldShell({ label, hint, error, hideLabel, className, children, htmlFor }: FieldShell) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className={cn('block text-sm font-semibold text-ink', hideLabel && 'sr-only')}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-center gap-1 text-xs font-semibold text-danger">
          <CircleAlert className="size-3.5" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = Omit<ComponentProps<'input'>, 'id'> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  hideLabel?: boolean;
  /** عنصر داخل الحقل في جهة النهاية: أيقونة تعديل أو إظهار */
  adornment?: ReactNode;
};

export function TextField({ id, label, hint, error, hideLabel, adornment, className, ...props }: InputProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} className={className} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            control,
            // الحقول اللاتينية (البريد) تُحاذى يميناً كبقية النموذج، والأيقونة في الجهة المقابلة
            props.dir === 'ltr' && 'text-right',
            adornment && (props.dir === 'ltr' ? 'pl-12' : 'pe-12'),
            error && 'bg-card ring-danger focus:ring-danger',
          )}
          {...props}
        />
        {adornment && <span className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted">{adornment}</span>}
      </div>
    </FieldShell>
  );
}

/** رقم الجوال: مفتاح الدولة في مربع منفصل، والأرقام من اليسار لليمين */
export function PhoneField({ id, label, hint, error, hideLabel, className, ...props }: InputProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} className={className} htmlFor={id}>
      <div
        dir="ltr"
        className={cn(
          'flex h-12 overflow-hidden rounded-ctl bg-field ring-1 ring-transparent transition focus-within:bg-card focus-within:ring-gold',
          error && 'bg-card ring-danger focus-within:ring-danger',
        )}
      >
        <span className="tabular flex items-center border-e border-line px-4 text-[15px] font-semibold text-muted">
          +966
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="tabular w-full bg-transparent px-4 text-[15px] tracking-wide text-ink outline-none placeholder:text-muted/60"
          {...props}
        />
      </div>
    </FieldShell>
  );
}

type SelectProps = Omit<ComponentProps<'select'>, 'id'> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  leading?: ReactNode;
};

export function SelectField({ id, label, hint, error, leading, className, children, ...props }: SelectProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className} htmlFor={id}>
      <div className="relative">
        {leading && <span className="absolute inset-y-0 start-0 flex items-center ps-3">{leading}</span>}
        <select id={id} className={cn(control, 'appearance-none pe-10', leading && 'ps-12')} {...props}>
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </FieldShell>
  );
}

export function TextArea({
  id,
  label,
  hint,
  className,
  ...props
}: Omit<ComponentProps<'textarea'>, 'id'> & { id: string; label: string; hint?: ReactNode }) {
  return (
    <FieldShell label={label} hint={hint} className={className} htmlFor={id}>
      <textarea id={id} className={cn(control, 'h-auto min-h-24 py-3 leading-relaxed')} {...props} />
    </FieldShell>
  );
}
