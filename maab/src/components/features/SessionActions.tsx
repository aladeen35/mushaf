'use client';

import { CalendarX, Info, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PillRadio } from '@/components/ui/Choice';
import { SelectField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { balanceEffect, FREE_CANCEL_HOURS, SELF_RESCHEDULES_PER_MONTH } from '@/lib/domain/sessions';
import { cn } from '@/lib/cn';

/**
 * إعادة الجدولة والإلغاء بقواعد القسم 7: المهلة 12 ساعة، وإعادة الجدولة
 * الذاتية مرتان في الشهر، وما بعد ذلك طلب يمرّ على المعلمة أو الدعم.
 */
export function SessionActions({
  label,
  hoursBefore,
  reschedulesUsed,
  alternatives,
}: {
  label: string;
  hoursBefore: number;
  reschedulesUsed: number;
  alternatives: string[];
}) {
  const [open, setOpen] = useState<'cancel' | 'reschedule' | null>(null);
  const [slot, setSlot] = useState(alternatives[0]);
  const [done, setDone] = useState<string>();
  const effect = balanceEffect({ kind: 'guardian_cancel', hoursBefore });
  const inWindow = hoursBefore >= FREE_CANCEL_HOURS;
  const canSelf = inWindow && reschedulesUsed < SELF_RESCHEDULES_PER_MONTH;

  if (done) return <p className="rounded-ctl bg-success/10 px-3 py-2 text-xs font-bold text-success">{done}</p>;

  return (
    <>
      <div className="flex gap-2">
        <Button size="xs" variant="soft" onClick={() => setOpen('reschedule')}>
          <RefreshCw className="size-3.5" aria-hidden />
          إعادة جدولة
        </Button>
        <Button size="xs" variant="ghost" className="text-danger hover:bg-danger/8" onClick={() => setOpen('cancel')}>
          <CalendarX className="size-3.5" aria-hidden />
          إلغاء
        </Button>
      </div>

      <Modal open={open === 'reschedule'} onClose={() => setOpen(null)} title="إعادة جدولة الحصة">
        <p className="text-center text-sm text-muted">{label}</p>
        {canSelf ? (
          <div className="mt-5 space-y-5">
            <PillRadio name="slot" legend="المواعيد المتاحة لدى المعلمة" options={alternatives.map((a) => ({ value: a, label: a }))} value={slot} onChange={setSlot} />
            <p className="flex items-start gap-2 rounded-ctl bg-field p-3 text-xs leading-5 text-muted">
              <Info className="mt-0.5 size-4 shrink-0 text-gold-text" aria-hidden />
              بقيت لكِ {SELF_RESCHEDULES_PER_MONTH - reschedulesUsed === 1 ? 'إعادة جدولة واحدة' : 'إعادتا جدولة'} هذا الشهر دون موافقة.
            </p>
            <Button block onClick={() => (setOpen(null), setDone(`تم نقل الحصة إلى ${slot}`))}>
              تأكيد الموعد الجديد
            </Button>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <p className="rounded-ctl border border-warning/30 bg-warning/8 p-3 text-sm leading-6 text-ink">
              {inWindow
                ? 'استنفدتِ إعادة الجدولة الذاتية لهذا الشهر، فيُرسل طلبك للمعلمة لتوافق عليه.'
                : `بقي على الحصة أقل من ${FREE_CANCEL_HOURS} ساعة، فيُرسل طلبك للمعلمة لتوافق عليه.`}
            </p>
            <Button block onClick={() => (setOpen(null), setDone('أُرسل طلب إعادة الجدولة للمعلمة'))}>
              إرسال الطلب
            </Button>
          </div>
        )}
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
          <SelectField id="reason" label="سبب الإلغاء" defaultValue="">
            <option value="" disabled>
              اختاري السبب
            </option>
            <option>مرض</option>
            <option>سفر</option>
            <option>ارتباط عائلي</option>
            <option>سبب آخر</option>
          </SelectField>
          <Button block variant="primary" className="bg-danger hover:bg-danger/90" onClick={() => (setOpen(null), setDone('أُلغيت الحصة'))}>
            تأكيد الإلغاء
          </Button>
        </div>
      </Modal>
    </>
  );
}
