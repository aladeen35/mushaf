'use client';

import { CalendarX, Info, LoaderCircle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PillRadio } from '@/components/ui/Choice';
import { SelectField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { api, errorText, IS_LIVE } from '@/lib/api';
import { balanceEffect, FREE_CANCEL_HOURS, SELF_RESCHEDULES_PER_MONTH } from '@/lib/domain/sessions';
import { cn } from '@/lib/cn';

type Slot = { value: string; label: string };

/**
 * إعادة الجدولة والإلغاء بقواعد القسم 7: المهلة 12 ساعة، وإعادة الجدولة
 * الذاتية مرتان في الشهر، وما بعد ذلك طلب يمرّ على المعلمة أو الدعم.
 * في النسخة الحية تأتي المواعيد من إتاحة المعلمة الفعلية، والخادم يحسم القاعدة.
 */
export function SessionActions({
  sessionId,
  teacherId,
  durationMin,
  tz,
  label,
  hoursBefore,
  reschedulesUsed,
  alternatives,
}: {
  sessionId: string;
  teacherId: string;
  durationMin: number;
  /** توقيت المستخدم لعرض المواعيد */
  tz: string;
  label: string;
  hoursBefore: number;
  reschedulesUsed: number;
  /** مواعيد بديلة لنسخة العرض */
  alternatives: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<'cancel' | 'reschedule' | null>(null);
  const [slots, setSlots] = useState<Slot[]>(alternatives.map((a) => ({ value: a, label: a })));
  const [slot, setSlot] = useState(alternatives[0] ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const effect = balanceEffect({ kind: 'guardian_cancel', hoursBefore });
  const inWindow = hoursBefore >= FREE_CANCEL_HOURS;
  const canSelf = inWindow && reschedulesUsed < SELF_RESCHEDULES_PER_MONTH;

  const openReschedule = async () => {
    setOpen('reschedule');
    setError(undefined);
    if (!IS_LIVE) return;
    setBusy(true);
    try {
      const q = new URLSearchParams({ teacherId, durationMin: String(durationMin), mode: 'single', days: '14', ignoreSessionId: sessionId });
      const { slots: found } = await api<{ slots: string[] }>(`/availability/search?${q}`);
      const fmt = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
      // كل ساعة تكفي للاختيار، فلا تزدحم القائمة بفواصل ربع الساعة
      const hourly = found.filter((iso) => new Date(iso).getUTCMinutes() % 30 === 0).slice(0, 12);
      const list = hourly.map((iso) => ({ value: iso, label: fmt.format(new Date(iso)) }));
      setSlots(list);
      setSlot(list[0]?.value ?? '');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (action: 'reschedule' | 'cancel') => {
    if (!IS_LIVE) {
      setOpen(null);
      const chosen = slots.find((s) => s.value === slot)?.label;
      setDone(action === 'cancel' ? 'أُلغيت الحصة' : canSelf ? `تم نقل الحصة إلى ${chosen}` : 'أُرسل طلب إعادة الجدولة للمعلمة');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      if (action === 'cancel') {
        const r = await api<{ deducted: boolean }>(`/sessions/${sessionId}/cancel`, { body: { reason: reason || 'سبب آخر' } });
        setDone(r.deducted ? 'أُلغيت الحصة وسُجّلت غياباً لأنها خلال 12 ساعة' : 'أُلغيت الحصة، والرصيد كما هو');
      } else {
        const r = await api<{ mode: 'moved' | 'requested' }>(`/sessions/${sessionId}/reschedule`, { body: { startsAt: slot, reason: reason || 'طلب ولي الأمر' } });
        setDone(r.mode === 'moved' ? `تم نقل الحصة إلى ${slots.find((s) => s.value === slot)?.label}` : 'أُرسل طلب إعادة الجدولة للمعلمة لتوافق عليه');
      }
      setOpen(null);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) return <p className="rounded-ctl bg-success/10 px-3 py-2 text-xs font-bold text-success">{done}</p>;

  const errorBox = error && <p className="rounded-ctl bg-danger/8 px-3 py-2 text-sm text-danger">{error}</p>;

  return (
    <>
      <div className="flex gap-2">
        <Button size="xs" variant="soft" onClick={openReschedule}>
          <RefreshCw className="size-3.5" aria-hidden />
          إعادة جدولة
        </Button>
        <Button size="xs" variant="ghost" className="text-danger hover:bg-danger/8" onClick={() => (setOpen('cancel'), setError(undefined))}>
          <CalendarX className="size-3.5" aria-hidden />
          إلغاء
        </Button>
      </div>

      <Modal open={open === 'reschedule'} onClose={() => setOpen(null)} title="إعادة جدولة الحصة">
        <p className="text-center text-sm text-muted">{label}</p>
        <div className="mt-5 space-y-5">
          {!canSelf && (
            <p className="rounded-ctl border border-warning/30 bg-warning/8 p-3 text-sm leading-6 text-ink">
              {inWindow
                ? 'استنفدتِ إعادة الجدولة الذاتية لهذا الشهر، فيُرسل طلبك للمعلمة لتوافق عليه.'
                : `بقي على الحصة أقل من ${FREE_CANCEL_HOURS} ساعة، فيُرسل طلبك للمعلمة لتوافق عليه.`}
            </p>
          )}
          {busy && !slots.length ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              نبحث في أوقات المعلمة…
            </p>
          ) : slots.length ? (
            <PillRadio name="slot" legend="المواعيد المتاحة لدى المعلمة" options={slots} value={slot} onChange={setSlot} />
          ) : (
            <p className="text-center text-sm text-muted">لا مواعيد متاحة لدى المعلمة في الأسبوعين القادمين.</p>
          )}
          {canSelf && (
            <p className="flex items-start gap-2 rounded-ctl bg-field p-3 text-xs leading-5 text-muted">
              <Info className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden />
              بقيت لكِ {SELF_RESCHEDULES_PER_MONTH - reschedulesUsed === 1 ? 'إعادة جدولة واحدة' : 'إعادتا جدولة'} هذا الشهر دون موافقة.
            </p>
          )}
          {errorBox}
          <Button block disabled={busy || !slot} onClick={() => submit('reschedule')}>
            {canSelf ? 'تأكيد الموعد الجديد' : 'إرسال الطلب'}
          </Button>
        </div>
      </Modal>

      <Modal open={open === 'cancel'} onClose={() => setOpen(null)} title="إلغاء الحصة">
        <p className="text-center text-sm text-muted">{label}</p>
        <div
          className={cn(
            'mt-5 rounded-ctl border p-3.5 text-sm leading-6',
            effect.deduct ? 'border-danger/30 bg-danger/6' : 'border-success/30 bg-success/8',
          )}
        >
          <p className={cn('font-bold', effect.deduct ? 'text-danger' : 'text-success')}>
            {effect.deduct ? 'تُخصم الحصة من الرصيد' : 'يعود الرصيد كاملًا'}
          </p>
          <p className="mt-1 text-ink">
            {effect.deduct
              ? `الإلغاء قبل الحصة بأقل من ${FREE_CANCEL_HOURS} ساعة يُسجَّل «${effect.outcome}».`
              : `الإلغاء قبل ${FREE_CANCEL_HOURS} ساعة أو أكثر، و${effect.action}.`}
          </p>
        </div>
        <div className="mt-4 space-y-5">
          <SelectField id={`reason-${sessionId}`} label="سبب الإلغاء" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="" disabled>
              اختاري السبب
            </option>
            <option>مرض</option>
            <option>سفر</option>
            <option>ارتباط عائلي</option>
            <option>سبب آخر</option>
          </SelectField>
          {errorBox}
          <Button block variant="primary" disabled={busy || !reason} className="bg-danger hover:bg-danger/90" onClick={() => submit('cancel')}>
            تأكيد الإلغاء
          </Button>
        </div>
      </Modal>
    </>
  );
}
