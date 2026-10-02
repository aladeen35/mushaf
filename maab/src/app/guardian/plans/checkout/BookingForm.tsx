'use client';

import { Star, TicketPercent } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, LeaderRow } from '@/components/ui/Card';
import { DayPills, PillRadio } from '@/components/ui/Choice';
import { cn } from '@/lib/cn';
import { applyCoupon, PAYMENT_HOLD_HOURS } from '@/lib/domain/billing';
import { fmtSAR } from '@/lib/format';

type Day = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export type TeacherOption = { id: string; name: string; headline: string; rating: number; free: Partial<Record<Day, string[]>> };

const DAYS: { value: Day; label: string }[] = [
  { value: 'sat', label: 'السبت' },
  { value: 'sun', label: 'الأحد' },
  { value: 'mon', label: 'الاثنين' },
  { value: 'tue', label: 'الثلاثاء' },
  { value: 'wed', label: 'الأربعاء' },
  { value: 'thu', label: 'الخميس' },
  { value: 'fri', label: 'الجمعة' },
];

// كوبون تجريبي لعرض الخصم — الكوبونات الفعلية تُدار من لوحة المالية
const DEMO_COUPONS: Record<string, { type: 'percent' | 'fixed'; value: number }> = { MAAB10: { type: 'percent', value: 10 } };

export function BookingForm({
  childId,
  childName,
  planId,
  planName,
  perWeek,
  sessions,
  duration,
  price,
  teachers,
  nextRef,
}: {
  childId: string;
  childName: string;
  planId: string;
  planName: string;
  perWeek: number;
  sessions: number;
  duration: number;
  price: number;
  teachers: TeacherOption[];
  nextRef: string;
}) {
  const router = useRouter();
  const [teacherId, setTeacherId] = useState(teachers[0].id);
  const teacher = teachers.find((t) => t.id === teacherId)!;
  const [days, setDays] = useState<Day[]>([]);
  const [times, setTimes] = useState<Partial<Record<Day, string>>>({});
  const [code, setCode] = useState('');
  const [coupon, setCoupon] = useState<string>();
  const [couponError, setCouponError] = useState<string>();
  const [error, setError] = useState<string>();

  const total = applyCoupon(price, coupon ? DEMO_COUPONS[coupon] : undefined);
  const ready = days.length === perWeek && days.every((d) => times[d]);

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <p className="text-sm font-bold text-ink">المعلمة</p>
        <div role="radiogroup" aria-label="المعلمة" className="space-y-2">
          {teachers.map((t) => (
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
              className={cn(
                'flex w-full items-center gap-3 rounded-ctl border-[1.5px] p-3 text-start transition',
                t.id === teacherId ? 'border-brand bg-brand/5' : 'border-line',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">{t.name}</span>
                <span className="block truncate text-xs text-muted">{t.headline}</span>
              </span>
              <span className="tabular flex items-center gap-1 text-sm font-bold text-gold-text">
                <Star className="size-4 fill-gold text-gold" aria-hidden />
                {t.rating}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-5 p-4">
        <DayPills
          legend={`أيام الحصة — اختاري ${perWeek === 1 ? 'يومًا واحدًا' : perWeek === 2 ? 'يومين' : 'ثلاثة أيام'}`}
          value={days}
          onChange={(v) => {
            setError(undefined);
            setDays(v.slice(-perWeek));
          }}
          options={DAYS.map((d) => ({ ...d, disabled: !teacher.free[d.value]?.length }))}
        />
        {days.map((d) => (
          <PillRadio
            key={d}
            name={`time-${d}`}
            legend={`الوقت يوم ${DAYS.find((x) => x.value === d)!.label}`}
            value={times[d] ?? ''}
            onChange={(v) => setTimes({ ...times, [d]: v })}
            options={(teacher.free[d] ?? []).map((t) => ({ value: t, label: t }))}
          />
        ))}
        <p className="text-xs text-muted">الأوقات بتوقيت الرياض، وتُعرض بحسب المنطقة الزمنية في ملفك.</p>
      </Card>

      <Card className="p-4">
        <p className="mb-2 text-sm font-bold text-ink">ملخّص الطلب</p>
        <LeaderRow label="الطالب" value={childName} />
        <LeaderRow label="الباقة" value={`${planName} · ${sessions} حصص`} />
        <LeaderRow label="مدة الحصة" value={`${duration} دقيقة`} />
        <LeaderRow label="السعر" value={fmtSAR(price)} />
        {coupon && <LeaderRow label={`الكوبون ${coupon}`} value={`− ${fmtSAR(price - total)}`} />}
        <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
          <span className="font-bold text-ink">الإجمالي</span>
          <span className="tabular text-xl font-bold text-brand">{fmtSAR(total)}</span>
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            if (DEMO_COUPONS[c]) {
              setCoupon(c);
              setCouponError(undefined);
            } else setCouponError('الكوبون غير صالح أو منتهٍ');
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
        {!coupon && <p className="mt-1.5 text-[11px] text-muted">للتجربة: MAAB10</p>}
      </Card>

      {error && <p className="text-center text-sm font-semibold text-danger">{error}</p>}
      <Button
        block
        onClick={() => {
          if (!ready) return setError(`اختاري ${perWeek === 1 ? 'اليوم والوقت' : 'الأيام والأوقات'} أولًا`);
          router.push(`/guardian/payments/${nextRef}?child=${childId}&plan=${planId}&duration=${duration}&amount=${total}`);
        }}
      >
        تأكيد الطلب والانتقال للدفع
      </Button>
      <p className="text-center text-xs leading-5 text-muted">
        تُحجز الأوقات {PAYMENT_HOLD_HOURS} ساعة حتى يصل التحويل، ثم تُتاح لغيرك إن لم يُدفع الطلب.
      </p>
    </div>
  );
}
