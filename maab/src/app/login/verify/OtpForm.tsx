'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

const LENGTH = 6;
const RESEND_AFTER = 60;
const MAX_ATTEMPTS = 5;

/** رمز التحقق: ست خانات، 5 محاولات ثم قفل 15 دقيقة (القسم 15) */
export function OtpForm({ phone }: { phone: string }) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [left, setLeft] = useState(RESEND_AFTER);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string>();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const code = digits.join('');
  const locked = attempts >= MAX_ATTEMPTS;

  function setAt(i: number, v: string) {
    const clean = v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
    if (clean.length > 1) {
      // لصق الرمز كاملاً
      const next = clean.slice(0, LENGTH).split('');
      setDigits([...next, ...Array(LENGTH - next.length).fill('')]);
      inputs.current[Math.min(next.length, LENGTH - 1)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    setError(undefined);
    if (clean && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length < LENGTH) return setError('أدخلي الرمز كاملًا');
        // نسخة العرض: الرمز 000000 خاطئ لتجربة رسالة الخطأ، وأي رمز آخر يُقبل
        if (code === '000000') {
          setAttempts((a) => a + 1);
          return setError(`رمز غير صحيح، بقيت ${MAX_ATTEMPTS - attempts - 1} محاولات`);
        }
        router.push('/onboarding');
      }}
    >
      <fieldset>
        <legend className="sr-only">رمز التحقق المرسل إلى {phone}</legend>
        <div dir="ltr" className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={`الخانة ${i + 1}`}
              maxLength={LENGTH}
              disabled={locked}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
              }}
              className={cn(
                'tabular size-12 rounded-ctl bg-field text-center text-xl font-bold text-ink outline-none ring-1 ring-transparent transition focus:bg-card focus:ring-gold',
                d && 'bg-card ring-brand/30',
                error && 'ring-danger',
              )}
            />
          ))}
        </div>
      </fieldset>
      {error && <p className="text-center text-xs font-semibold text-danger">{error}</p>}
      {locked && (
        <p className="text-center text-xs font-semibold text-danger">تجاوزتِ عدد المحاولات، حاولي بعد 15 دقيقة.</p>
      )}

      <Button type="submit" block disabled={locked}>
        تحقّق
      </Button>

      <p className="text-center text-sm text-muted">
        {left > 0 ? (
          <>
            إعادة الإرسال بعد <span className="tabular font-bold text-ink">0:{String(left).padStart(2, '0')}</span>
          </>
        ) : (
          <button type="button" className="font-bold text-brand" onClick={() => setLeft(RESEND_AFTER)}>
            أعيدي إرسال الرمز
          </button>
        )}
      </p>
    </form>
  );
}
