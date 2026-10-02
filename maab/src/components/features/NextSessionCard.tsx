import { CalendarClock, Clock, Video } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { GoldCard } from '@/components/ui/Card';
import { joinState, joinWindow } from '@/lib/domain/sessions';
import { fmtIn, fmtRelativeDay, fmtTime, fmtTimeRange } from '@/lib/format';

/**
 * بطاقة الحصة القادمة: كريمية بشريط ذهبي علوي وزر «ادخل الحصة».
 * الزر يظهر قبل الموعد بـ10 دقائق ويختفي بعد نهايتها بـ15 دقيقة.
 */
export function NextSessionCard({
  sessionId,
  who,
  teacher,
  note,
  startsAt,
  durationMin,
  now,
  manageHref,
}: {
  sessionId: string;
  who: string;
  teacher?: string;
  /** سطر إضافي، كمقطع الحصة للمعلمة */
  note?: string;
  startsAt: Date;
  durationMin: number;
  now: Date;
  manageHref?: string;
}) {
  const state = joinState(now, startsAt, durationMin);
  const { opensAt } = joinWindow(startsAt, durationMin);
  return (
    <GoldCard>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-gold-text">{state === 'open' ? 'الحصة الآن' : 'الحصة القادمة'}</p>
            <p className="mt-1 text-lg font-bold text-ink">
              {who} {teacher && <span className="font-semibold text-muted">مع {teacher}</span>}
            </p>
            {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
          </div>
          <span className="grid size-11 shrink-0 place-items-center rounded-ctl bg-brand/8 text-brand" aria-hidden>
            <Video className="size-5" />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-4 text-gold-text" aria-hidden />
            <span className="font-semibold text-ink">{fmtRelativeDay(startsAt, now)}</span>
            <span className="tabular">{fmtTimeRange(startsAt, durationMin)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-gold-text" aria-hidden />
            {fmtIn(now, startsAt)}
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          {state === 'open' ? (
            <ButtonLink href={`/sessions/${sessionId}/join`} block>
              <Video className="size-5" aria-hidden />
              ادخل الحصة
            </ButtonLink>
          ) : (
            <span
              aria-disabled
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-ctl bg-brand/8 text-sm font-bold text-brand/70"
            >
              <Video className="size-4" aria-hidden />
              يُفتح الدخول {fmtTime(opensAt)}
            </span>
          )}
          {manageHref && (
            <ButtonLink href={manageHref} variant="secondary" className="shrink-0">
              إدارة
            </ButtonLink>
          )}
        </div>
      </div>
    </GoldCard>
  );
}
