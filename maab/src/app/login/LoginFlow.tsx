'use client';

import { Mail, MessageCircle, MessageSquareText, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { guessCountry, PhoneInput } from '@/components/ui/PhoneInput';
import { api, ApiFailure, errorText, IS_LIVE } from '@/lib/api';
import { cn } from '@/lib/cn';
import { OTP_CHANNEL_LABEL, otpChannels, type CountryCode, type OtpChannel } from '@/lib/domain/market';
import { displayPhone, parsePhone } from '@/lib/phone';
import { GoogleButton } from './GoogleButton';

const LENGTH = 6;
const MAX_ATTEMPTS = 5;

type Sent = { channel: OtpChannel; fallbacks: OtpChannel[]; resendInSec: number; to: string };
type Target = { kind: 'phone'; e164: string; country: CountryCode } | { kind: 'email'; email: string };

const CHANNEL_ICON: Record<OtpChannel, typeof MessageCircle> = { whatsapp: MessageCircle, sms: MessageSquareText, email: Mail };

/**
 * الدخول برمز لمرة واحدة: واتساب أولاً لكل الأرقام، والرسالة النصية احتياطاً
 * للأرقام السعودية، والبريد أو Google لغيرها. لا كلمات مرور.
 */
export function LoginFlow() {
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [country, setCountry] = useState<CountryCode>('SD');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<Target>();
  const [sent, setSent] = useState<Sent>();

  // الدولة المرجّحة من منطقة الجهاز بعد التحميل (السودان إن لم تُعرف)
  useEffect(() => {
    const t = setTimeout(() => setCountry(guessCountry()), 0);
    return () => clearTimeout(t);
  }, []);

  async function send(to: Target, channel?: OtpChannel) {
    setBusy(true);
    setError(undefined);
    try {
      let r: Sent;
      if (IS_LIVE) {
        r = await api<Sent>('/auth/otp/send', { body: to.kind === 'phone' ? { phone: to.e164, country: to.country, ...(channel ? { channel } : {}) } : { email: to.email } });
      } else {
        const all = to.kind === 'phone' ? otpChannels(to.country) : (['email'] as OtpChannel[]);
        const ch = channel ?? all[0];
        r = { channel: ch, fallbacks: all.filter((c) => c !== ch), resendInSec: 60, to: to.kind === 'phone' ? to.e164 : to.email };
      }
      setTarget(to);
      setSent(r);
    } catch (e) {
      // تعذّر الإرسال عبر القناة: تُقترح البديلة مباشرة
      if (e instanceof ApiFailure && e.code === 'channel_failed' && to.kind === 'phone') {
        setTarget(to);
        setSent({ channel: channel ?? 'whatsapp', fallbacks: (e.details as { fallbacks?: OtpChannel[] })?.fallbacks ?? [], resendInSec: 0, to: to.e164 });
      }
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (target && sent) {
    return (
      <CodeStep
        target={target}
        sent={sent}
        notice={error}
        busy={busy}
        onResend={(ch) => send(target, ch)}
        onEmail={() => {
          setSent(undefined);
          setTarget(undefined);
          setError(undefined);
          setMode('email');
        }}
        onBack={() => {
          setSent(undefined);
          setTarget(undefined);
          setError(undefined);
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {mode === 'phone' ? (
        <form
          className="space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const p = parsePhone(phone, country);
            if (!p) return setError('الرقم غير صحيح، تأكدي من الدولة والرقم');
            send({ kind: 'phone', e164: p.e164, country: p.country });
          }}
        >
          <PhoneInput
            id="phone"
            label="رقم الجوال"
            country={country}
            onCountry={(c) => (setCountry(c), setError(undefined))}
            value={phone}
            onValue={(v) => (setPhone(v), setError(undefined))}
            placeholder={country === 'SD' ? '91 234 5678' : country === 'SA' ? '5X XXX XXXX' : ''}
            error={error}
            hint="نرسل رمز الدخول على واتساب، صالحًا لخمس دقائق."
          />
          <Button type="submit" block disabled={busy}>
            <Smartphone className="size-5" aria-hidden />
            أرسل الرمز على واتساب
          </Button>
          <p className="text-center text-xs text-muted">
            ما عندك واتساب؟{' '}
            <button type="button" className="font-bold text-brand" onClick={() => (setMode('email'), setError(undefined))}>
              ادخلي بالبريد الإلكتروني
            </button>
          </p>
        </form>
      ) : (
        <form
          className="space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const v = email.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError('صيغة البريد غير صحيحة');
            send({ kind: 'email', email: v });
          }}
        >
          <TextField
            id="email"
            label="البريد الإلكتروني"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder="name@example.com"
            className="[&_input]:text-left"
            value={email}
            error={error}
            onChange={(e) => (setEmail(e.target.value), setError(undefined))}
            hint="للمقيمين خارج السعودية: نرسل الرمز إلى بريدك."
          />
          <Button type="submit" block disabled={busy}>
            <Mail className="size-5" aria-hidden />
            أرسل الرمز إلى بريدي
          </Button>
          <p className="text-center text-xs text-muted">
            <button type="button" className="font-bold text-brand" onClick={() => (setMode('phone'), setError(undefined))}>
              الرجوع للدخول برقم الجوال
            </button>
          </p>
        </form>
      )}
      <Divider />
      <GoogleButton country={country} />
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-line" />
      أو
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function CodeStep({
  target,
  sent,
  notice,
  busy,
  onResend,
  onEmail,
  onBack,
}: {
  target: Target;
  sent: Sent;
  notice?: string;
  busy: boolean;
  onResend: (channel?: OtpChannel) => void;
  onEmail: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [left, setLeft] = useState(sent.resendInSec);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const Icon = CHANNEL_ICON[sent.channel];

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const code = digits.join('');
  const shown = target.kind === 'phone' ? displayPhone(target.e164) : target.email;

  function setAt(i: number, v: string) {
    const clean = v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
    if (clean.length > 1) {
      // لصق الرمز كاملاً أو ملؤه تلقائياً من رسالة واتساب
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

  async function verify() {
    if (code.length < LENGTH) return setError('أدخلي الرمز كاملًا');
    if (!IS_LIVE) {
      // نسخة العرض: الرمز 000000 خاطئ لتجربة رسالة الخطأ، وأي رمز آخر يُقبل
      if (code === '000000') {
        const n = attempts + 1;
        setAttempts(n);
        if (n >= MAX_ATTEMPTS) return setLocked(true);
        return setError(`رمز غير صحيح، بقيت ${MAX_ATTEMPTS - n} محاولات`);
      }
      return router.push('/onboarding');
    }
    setChecking(true);
    setError(undefined);
    try {
      const body = target.kind === 'phone' ? { phone: target.e164, country: target.country, code } : { email: target.email, country: guessCountry(), code };
      const r = await api<{ next: string }>('/auth/otp/verify', { body });
      // كوكيز الجلسة حفظه المتصفح من الاستجابة، فتقرؤه الصفحة التالية
      router.push(r.next);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 429) setLocked(true);
      setError(errorText(e));
      setChecking(false);
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        verify();
      }}
    >
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-success/10 text-success" aria-hidden>
          <Icon className="size-7" strokeWidth={1.7} />
        </span>
        <p className="mt-3 text-sm text-muted">
          أرسلنا رمزًا من ستة أرقام عبر <b className="text-ink">{OTP_CHANNEL_LABEL[sent.channel]}</b> إلى
        </p>
        <p className="mt-1 text-sm">
          <bdi dir="ltr" className="tabular font-bold text-ink">
            {shown}
          </bdi>
          {' · '}
          <button type="button" onClick={onBack} className="font-semibold text-brand underline">
            تغيير
          </button>
        </p>
      </div>

      <fieldset>
        <legend className="sr-only">رمز الدخول المرسل إلى {shown}</legend>
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
      {(error ?? notice) && <p className="text-center text-xs font-semibold text-danger">{error ?? notice}</p>}
      {locked && <p className="text-center text-xs font-semibold text-danger">تجاوزتِ عدد المحاولات، حاولي بعد 15 دقيقة.</p>}

      <Button type="submit" block disabled={locked || checking}>
        تحقّق
      </Button>

      <div className="space-y-2 text-center text-sm text-muted">
        {left > 0 ? (
          <p>
            إعادة الإرسال بعد <span className="tabular font-bold text-ink">0:{String(left).padStart(2, '0')}</span>
          </p>
        ) : (
          <>
            <button type="button" className="font-bold text-brand" disabled={busy} onClick={() => (onResend(sent.channel), setLeft(60))}>
              أعيدي إرسال الرمز عبر {OTP_CHANNEL_LABEL[sent.channel]}
            </button>
            {sent.fallbacks.map((f) => (
              <p key={f}>
                لم يصلك؟{' '}
                <button
                  type="button"
                  className="font-bold text-brand"
                  disabled={busy}
                  onClick={() => (f === 'email' ? onEmail() : (onResend(f), setLeft(60)))}
                >
                  {f === 'sms' ? 'أرسليه برسالة نصية' : 'استلميه على البريد الإلكتروني'}
                </button>
              </p>
            ))}
          </>
        )}
      </div>
      {!IS_LIVE && <p className="text-center text-xs text-muted">نسخة العرض: أي رمز يُقبل عدا 000000.</p>}
    </form>
  );
}
