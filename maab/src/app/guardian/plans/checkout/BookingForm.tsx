'use client';

import { LoaderCircle, Star, TicketPercent } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, LeaderRow } from '@/components/ui/Card';
import { DayPills, PillRadio } from '@/components/ui/Choice';
import { api, errorText, IS_LIVE, newKey } from '@/lib/api';
import { cn } from '@/lib/cn';
import { applyCoupon, DURATIONS, PAYMENT_HOLD_HOURS, plan, PLANS, type Duration, type PlanId } from '@/lib/domain/billing';
import { formatMoney, PAYMENT_METHODS, timezoneLabel, type Currency, type PaymentMethod } from '@/lib/domain/market';

type Day = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';
type Free = Partial<Record<Day, { value: string; label: string }[]>>;

export type BookingChild = { id: string; name: string; fullName: string; teacherId: string; category: 'children' | 'women' };
export type TeacherOption = { id: string; name: string; headline: string; rating: number; categories: ('children' | 'women')[]; free?: Free };

/** ترتيب أيام الأسبوع كما يعرضها التقويم في السعودية والسودان، بدءاً بالسبت */
const DAYS: { value: Day; label: string }[] = [
  { value: 'sat', label: 'السبت' },
  { value: 'sun', label: 'الأحد' },
  { value: 'mon', label: 'الاثنين' },
  { value: 'tue', label: 'الثلاثاء' },
  { value: 'wed', label: 'الأربعاء' },
  { value: 'thu', label: 'الخميس' },
  { value: 'fri', label: 'الجمعة' },
];
const BY_INDEX: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** «17:30» ← «5:30 م» */
const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
};

// كوبون تجريبي لعرض الخصم في نسخة العرض — الكوبونات الفعلية تُدار من لوحة المالية
const DEMO_COUPONS: Record<string, { type: 'percent' | 'fixed'; value: number }> = { MAAB10: { type: 'percent', value: 10 } };

type Props = {
  kids: BookingChild[];
  teachers: TeacherOption[];
  prices: Record<PlanId, Partial<Record<Duration, number>>>;
  currency: Currency;
  method: PaymentMethod;
  tz: string;
  /** رقم الطلب التالي في نسخة العرض */
  demoRef: string;
};

/** الطالب والباقة والمدة من الرابط (?child=&plan=&duration=) تُقرأ في المتصفح */
export function BookingForm(props: Props) {
  return (
    <Suspense
      fallback={
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          لحظة…
        </p>
      }
    >
      <FromLink {...props} />
    </Suspense>
  );
}

function FromLink(props: Props) {
  const sp = useSearchParams();
  const child = props.kids.find((k) => k.id === sp.get('child')) ?? props.kids[0];
  const planId = (PLANS.some((p) => p.id === sp.get('plan')) ? sp.get('plan') : 'regular') as PlanId;
  const d = Number(sp.get('duration'));
  const duration = (DURATIONS.includes(d as Duration) ? d : 45) as Duration;
  if (!child) return <Card className="p-4 text-sm text-muted">أضيفي ابنكِ أولاً.</Card>;
  return <Form key={`${child.id}-${planId}-${duration}`} {...props} child={child} planId={planId} duration={duration} />;
}

function Form({ child, planId, duration, teachers, prices, currency, method, tz, demoRef }: Props & { child: BookingChild; planId: PlanId; duration: Duration }) {
  const router = useRouter();
  const tier = plan(planId);
  const price = prices[planId][duration] ?? 0;
  // المعلمات المسموح لهن بفئة الطالب فقط (أطفال أو نساء)، والمعلمة الحالية أولاً
  const options = useMemo(
    () => teachers.filter((t) => t.categories.includes(child.category)).sort((a, b) => (a.id === child.teacherId ? -1 : b.id === child.teacherId ? 1 : 0)),
    [teachers, child],
  );
  const [teacherId, setTeacherId] = useState(options[0]?.id ?? '');
  const [fetched, setFetched] = useState<Record<string, Free>>({});
  const free = IS_LIVE ? fetched[teacherId] : options.find((t) => t.id === teacherId)?.free;
  const loading = IS_LIVE && Boolean(teacherId) && !fetched[teacherId];
  const [days, setDays] = useState<Day[]>([]);
  const [times, setTimes] = useState<Partial<Record<Day, string>>>({});
  const [code, setCode] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: number }>();
  const [couponError, setCouponError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [key] = useState(newKey);

  // الأوقات الأسبوعية الحرّة في كل أسابيع الباقة، بتوقيت ولي الأمر
  useEffect(() => {
    if (!IS_LIVE || !teacherId || fetched[teacherId]) return;
    let alive = true;
    const weeks = Math.ceil(tier.sessions / tier.perWeek);
    api<{ weekly: { weekday: number; time: string }[] }>(`/availability/search?teacherId=${teacherId}&durationMin=${duration}&weeks=${weeks}`)
      .then(({ weekly }) => {
        const map: Free = {};
        for (const w of weekly.filter((x) => x.time.endsWith(':00') || x.time.endsWith(':30'))) {
          (map[BY_INDEX[w.weekday]] ??= []).push({ value: w.time, label: time12(w.time) });
        }
        if (alive) setFetched((m) => ({ ...m, [teacherId]: map }));
      })
      .catch((e) => {
        if (!alive) return;
        setError(errorText(e));
        setFetched((m) => ({ ...m, [teacherId]: {} }));
      });
    return () => {
      alive = false;
    };
  }, [teacherId, duration, tier.sessions, tier.perWeek, fetched]);

  const teacher = options.find((t) => t.id === teacherId);
  const total = coupon ? Math.max(0, Math.round((price - coupon.discount) * 100) / 100) : price;
  const ready = days.length === tier.perWeek && days.every((x) => times[x]);

  const applyCode = async () => {
    const c = code.trim().toUpperCase();
    setCouponError(undefined);
    if (!c) return;
    if (!IS_LIVE) {
      const demo = DEMO_COUPONS[c];
      return demo ? setCoupon({ code: c, discount: price - applyCoupon(price, demo) }) : setCouponError('الكوبون غير صالح أو منتهٍ');
    }
    try {
      const r = await api<{ code: string; discount: number }>('/coupons/validate', { body: { code: c, planCodes: [planId], subtotal: price } });
      setCoupon(r);
    } catch (e) {
      setCouponError(errorText(e));
    }
  };

  const submit = async () => {
    if (!ready) return setError(`اختاري ${tier.perWeek === 1 ? 'اليوم والوقت' : 'الأيام والأوقات'} أولًا`);
    if (!IS_LIVE) return router.push(`/guardian/payments/${demoRef}?child=${child.id}&plan=${planId}&duration=${duration}&amount=${total}`);
    setBusy(true);
    setError(undefined);
    try {
      const order = await api<{ ref: string }>('/orders', {
        idempotencyKey: key,
        body: {
          items: [{ studentId: child.id, planCode: planId, durationMin: duration, teacherId, slots: days.map((x) => ({ weekday: BY_INDEX.indexOf(x), time: times[x] })) }],
          method,
          ...(coupon ? { couponCode: coupon.code } : {}),
        },
      });
      router.push(`/guardian/payments/${order.ref}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-center text-sm font-semibold text-muted">
        باقة {tier.name} لـ{child.name} · {duration} دقيقة
      </p>
      <Card className="space-y-3 p-4">
        <p className="text-sm font-bold text-ink">المعلمة</p>
        {!options.length && <p className="text-sm text-muted">لا معلمة متاحة لهذه الفئة الآن، تواصلي مع الدعم.</p>}
        <div role="radiogroup" aria-label="المعلمة" className="space-y-2">
          {options.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === teacherId}
              onClick={() => {
                setTeacherId(t.id);
                setDays([]);
                setTimes({});
              }}
              className={cn('flex w-full items-center gap-3 rounded-ctl border-[1.5px] p-3 text-start transition', t.id === teacherId ? 'border-brand bg-brand/5' : 'border-line')}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">{t.name}</span>
                <span className="block truncate text-xs text-muted">{t.headline}</span>
              </span>
              {t.rating > 0 && (
                <span className="tabular flex items-center gap-1 text-sm font-bold text-gold-text">
                  <Star className="size-4 fill-gold text-gold" aria-hidden />
                  {t.rating}
                </span>
              )}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-5 p-4">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            نبحث في أوقات {teacher?.name ?? 'المعلمة'}…
          </p>
        ) : (
          <>
            <DayPills
              legend={`أيام الحصة — اختاري ${tier.perWeek === 1 ? 'يومًا واحدًا' : tier.perWeek === 2 ? 'يومين' : 'ثلاثة أيام'}`}
              value={days}
              onChange={(v) => {
                setError(undefined);
                setDays(v.slice(-tier.perWeek));
              }}
              options={DAYS.map((x) => ({ ...x, disabled: !free?.[x.value]?.length }))}
            />
            {days.map((x) => (
              <PillRadio
                key={x}
                name={`time-${x}`}
                legend={`الوقت يوم ${DAYS.find((y) => y.value === x)!.label}`}
                value={times[x] ?? ''}
                onChange={(v) => setTimes({ ...times, [x]: v })}
                options={free?.[x] ?? []}
              />
            ))}
          </>
        )}
        <p className="text-xs text-muted">الأوقات بتوقيت {timezoneLabel(tz)}، والمعلمة تراها بتوقيتها. يُعدَّل التوقيت من حسابك.</p>
      </Card>

      <Card className="p-4">
        <p className="mb-2 text-sm font-bold text-ink">ملخّص الطلب</p>
        <LeaderRow label="الطالب" value={child.fullName} />
        <LeaderRow label="الباقة" value={`${tier.name} · ${tier.sessions} حصص`} />
        <LeaderRow label="مدة الحصة" value={`${duration} دقيقة`} />
        <LeaderRow label="طريقة الدفع" value={PAYMENT_METHODS[method].label} />
        <LeaderRow label="السعر" value={formatMoney(price, currency)} />
        {coupon && <LeaderRow label={`الكوبون ${coupon.code}`} value={`− ${formatMoney(coupon.discount, currency)}`} />}
        <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
          <span className="font-bold text-ink">الإجمالي</span>
          <span className="tabular text-xl font-bold text-brand">{formatMoney(total, currency)}</span>
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyCode();
          }}
        >
          <label htmlFor="coupon" className="sr-only">
            كوبون الخصم
          </label>
          <span className="relative flex-1">
            <TicketPercent className="absolute inset-y-0 right-3 my-auto size-4 text-gold-text" aria-hidden />
            <input
              id="coupon"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="كوبون الخصم"
              className="h-10 w-full rounded-ctl bg-field pr-9 pl-3 text-right text-sm uppercase outline-none focus:ring-1 focus:ring-gold"
            />
          </span>
          <Button type="submit" size="sm" variant="secondary">
            تطبيق
          </Button>
        </form>
        {couponError && <p className="mt-1.5 text-xs font-semibold text-danger">{couponError}</p>}
        {!coupon && !IS_LIVE && <p className="mt-1.5 text-[11px] text-muted">للتجربة: MAAB10</p>}
      </Card>

      {error && <p className="text-center text-sm font-semibold text-danger">{error}</p>}
      <Button block disabled={busy || !teacherId} onClick={submit}>
        تأكيد الطلب والانتقال للدفع
      </Button>
      <p className="text-center text-xs leading-5 text-muted">
        تُحجز الأوقات {PAYMENT_HOLD_HOURS} ساعة حتى يصل التحويل، ثم تُتاح لغيرك إن لم يُدفع الطلب.
      </p>
    </div>
  );
}
