import { ArrowLeft, CalendarClock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChildPanels, ChildTabs } from '@/components/features/ChildTabs';
import { RescheduleRequest } from '@/components/features/RescheduleRequest';
import { SessionActions } from '@/components/features/SessionActions';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { cn } from '@/lib/cn';
import { dataset, type Dataset } from '@/lib/data';
import { hoursUntil } from '@/lib/domain/sessions';
import { currentTz, dayKey, fmtDayMonth, fmtRelativeDay, fmtTime, fmtTimeRange, fmtWeekday } from '@/lib/format';
import { SESSION_STATUS } from '@/lib/labels';
import { addDays, weekdayOf, zonedToUtc } from '@/lib/tz';
import type { Student } from '@/lib/types';

export const metadata: Metadata = { title: 'الجدول' };

export default async function Schedule() {
  const d = await dataset('guardian');
  const kids = d.childrenOf();
  return (
    <>
      <WaveHeader title="الجدول" back="/guardian">
        <div className="flex justify-center pt-1 pb-2">
          <ChildTabs items={kids} base="/guardian/schedule" />
        </div>
      </WaveHeader>
      <Page className="-mt-6">
        {kids.length ? (
          <ChildPanels panels={Object.fromEntries(kids.map((k) => [k.id, <ChildSchedule key={k.id} d={d} child={k} />]))} />
        ) : (
          <Card className="p-4 text-sm text-muted">أضيفي ابنكِ أولاً ثم اختاري باقة لتظهر الحصص هنا.</Card>
        )}
      </Page>
    </>
  );
}

function ChildSchedule({ d, child }: { d: Dataset; child: Student }) {
  const at = d.now();
  const tz = currentTz();
  const next = d.upcoming([child.id], at);
  const history = d.past([child.id], at);

  // أسبوع يبدأ بالأحد بتوقيت المستخدم نفسه
  const today = dayKey(at);
  const week = Array.from({ length: 7 }, (_, i) => zonedToUtc(addDays(today, i - weekdayOf(today)), '12:00', tz));
  const sessionDays = new Set(next.map((s) => dayKey(new Date(s.startsAt))));
  const requests = next.filter((s) => s.reschedule?.by === 'teacher');

  return (
    <div className="space-y-6">
      <Card className="p-3">
        <ol className="grid grid-cols-7 gap-1 text-center" aria-label="هذا الأسبوع">
          {week.map((day) => {
            const isToday = dayKey(day) === today;
            const has = sessionDays.has(dayKey(day));
            return (
              <li
                key={day.toISOString()}
                className={cn('flex flex-col items-center gap-1 rounded-ctl py-2', isToday && 'bg-brand text-on-brand')}
                aria-current={isToday ? 'date' : undefined}
              >
                <span className={cn('text-[10px] font-semibold', isToday ? 'opacity-80' : 'text-muted')}>{fmtWeekday(day).replace('ال', '')}</span>
                <span className="tabular text-base font-bold">{fmtDayMonth(day).split(' ')[0]}</span>
                <span className={cn('size-1.5 rounded-full', has ? (isToday ? 'bg-gold' : 'bg-brand') : 'bg-transparent')} aria-label={has ? 'فيه حصة' : undefined} />
              </li>
            );
          })}
        </ol>
      </Card>

      {requests.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>طلبات بانتظار ردّك</SectionTitle>
          {requests.map((s) => (
            <Card key={s.id} className="border-s-4 border-gold p-4">
              <p className="text-sm font-bold text-ink">{d.getTeacher(s.teacherId).name} تطلب نقل الحصة</p>
              <p className="mt-1 text-xs text-muted">{s.reschedule!.reason}</p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="tabular rounded-lg bg-field px-2.5 py-1 text-muted line-through">
                  {fmtWeekday(new Date(s.startsAt))} {fmtTime(new Date(s.startsAt))}
                </span>
                <ArrowLeft className="size-4 text-gold-text" aria-hidden />
                <span className="tabular rounded-lg bg-brand/10 px-2.5 py-1 font-bold text-brand">
                  {fmtWeekday(new Date(s.reschedule!.proposedAt))} {fmtTime(new Date(s.reschedule!.proposedAt))}
                </span>
              </div>
              <div className="mt-3">
                <RescheduleRequest requestId={s.reschedule!.requestId} />
              </div>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle>الحصص القادمة</SectionTitle>
        {next.length === 0 && (
          <Card className="flex items-center gap-3 p-4">
            <p className="flex-1 text-sm text-muted">لسه ما في حصص قادمة لـ{child.name}.</p>
            <ButtonLink href={`/guardian/plans?child=${child.id}`} size="xs">
              اختاري باقة
            </ButtonLink>
          </Card>
        )}
        {next.map((s) => {
          const start = new Date(s.startsAt);
          const teacher = d.getTeacher(s.teacherId);
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="grid w-14 shrink-0 place-items-center rounded-ctl bg-field py-2 text-center">
                  <span className="text-[10px] font-semibold text-muted">{fmtRelativeDay(start, at)}</span>
                  <span className="tabular text-lg leading-tight font-bold text-ink">{fmtDayMonth(start).split(' ')[0]}</span>
                  <span className="text-[10px] text-muted">{fmtDayMonth(start).split(' ')[1]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-ink">{child.name}</p>
                    <Badge tone="gold" icon={<CalendarClock className="size-3.5" aria-hidden />}>
                      {s.durationMin} دقيقة
                    </Badge>
                  </div>
                  <p className="tabular mt-0.5 text-sm text-muted">
                    {fmtTimeRange(start, s.durationMin)} · {teacher.name}
                  </p>
                  {s.reschedule?.by === 'guardian' ? (
                    <p className="mt-3 rounded-ctl bg-gold/12 px-3 py-2 text-xs font-semibold text-gold-text">
                      طلبتِ نقلها إلى {fmtWeekday(new Date(s.reschedule.proposedAt))} {fmtTime(new Date(s.reschedule.proposedAt))} — بانتظار المعلمة
                    </p>
                  ) : (
                    <div className="mt-3">
                      <SessionActions
                        sessionId={s.id}
                        teacherId={s.teacherId}
                        durationMin={s.durationMin}
                        tz={tz}
                        label={`${fmtWeekday(start)} ${fmtDayMonth(start)} · ${fmtTime(start)}`}
                        hoursBefore={hoursUntil(at, start)}
                        reschedulesUsed={d.mode === 'demo' ? 1 : 0}
                        alternatives={d.mode === 'demo' ? ['الاثنين 5:00 م', 'الأربعاء 4:00 م', 'الأربعاء 6:30 م', 'السبت 11:00 ص'] : []}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      <section className="space-y-3">
        <SectionTitle>الحصص السابقة</SectionTitle>
        {history.length ? (
          <Card className="divide-y divide-line">
            {history.map((s) => {
              const start = new Date(s.startsAt);
              const st = SESSION_STATUS[s.status];
              const row = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {fmtWeekday(start)} {fmtDayMonth(start)}
                    </span>
                    <span className="tabular block text-xs text-muted">{fmtTimeRange(start, s.durationMin)}</span>
                  </span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </>
              );
              return s.reportId ? (
                <Link key={s.id} href={`/guardian/reports/${s.reportId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-field">
                  {row}
                </Link>
              ) : (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  {row}
                </div>
              );
            })}
          </Card>
        ) : (
          <Card className="p-4 text-sm text-muted">لسه ما في حصص سابقة.</Card>
        )}
        <p className="px-1 text-xs leading-5 text-muted">
          الإلغاء قبل 12 ساعة أو أكثر يعيد الرصيد، وبعدها أو الغياب دون إشعار يخصم الحصة. غياب المعلمة يوجب حصة تعويضية.
        </p>
      </section>
    </div>
  );
}
