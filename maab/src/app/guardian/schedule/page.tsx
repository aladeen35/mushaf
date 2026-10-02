import { ArrowLeft, CalendarClock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChildTabs, pickChild } from '@/components/features/ChildTabs';
import { RescheduleRequest } from '@/components/features/RescheduleRequest';
import { SessionActions } from '@/components/features/SessionActions';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { cn } from '@/lib/cn';
import { hoursUntil } from '@/lib/domain/sessions';
import { childrenOf, getStudent, getTeacher, now, past, upcoming } from '@/lib/demo/queries';
import { dayKey, fmtDayMonth, fmtRelativeDay, fmtTime, fmtTimeRange, fmtWeekday } from '@/lib/format';
import { SESSION_STATUS } from '@/lib/labels';

export const metadata: Metadata = { title: 'الجدول' };

const DAY = 86_400_000;

export default async function Schedule({ searchParams }: PageProps<'/guardian/schedule'>) {
  const { child: childParam } = await searchParams;
  const kids = childrenOf();
  const child = pickChild(kids, childParam);
  const at = now();
  const next = upcoming([child.id], at);
  const history = past([child.id], at);

  // أسبوع يبدأ بالأحد بتوقيت الرياض
  const todayIdx = new Date(`${dayKey(at)}T12:00:00+03:00`).getUTCDay();
  const weekStart = new Date(`${dayKey(at)}T12:00:00+03:00`).getTime() - todayIdx * DAY;
  const week = Array.from({ length: 7 }, (_, i) => new Date(weekStart + i * DAY));
  const sessionDays = new Set(next.map((s) => dayKey(new Date(s.startsAt))));

  return (
    <>
      <WaveHeader title="الجدول" back="/guardian">
        <div className="flex justify-center pt-1 pb-2">
          <ChildTabs items={kids} active={child.id} base="/guardian/schedule" />
        </div>
      </WaveHeader>

      <Page className="-mt-6">
        <Card className="p-3">
          <ol className="grid grid-cols-7 gap-1 text-center" aria-label="هذا الأسبوع">
            {week.map((d) => {
              const today = dayKey(d) === dayKey(at);
              const has = sessionDays.has(dayKey(d));
              return (
                <li
                  key={d.toISOString()}
                  className={cn('flex flex-col items-center gap-1 rounded-ctl py-2', today && 'bg-brand text-on-brand')}
                  aria-current={today ? 'date' : undefined}
                >
                  <span className={cn('text-[10px] font-semibold', today ? 'opacity-80' : 'text-muted')}>{fmtWeekday(d).replace('ال', '')}</span>
                  <span className="tabular text-base font-bold">{fmtDayMonth(d).split(' ')[0]}</span>
                  <span className={cn('size-1.5 rounded-full', has ? (today ? 'bg-gold' : 'bg-brand') : 'bg-transparent')} aria-label={has ? 'فيه حصة' : undefined} />
                </li>
              );
            })}
          </ol>
        </Card>

        {next.some((s) => s.reschedule) && (
          <section className="space-y-3">
            <SectionTitle>طلبات بانتظار ردّك</SectionTitle>
            {next
              .filter((s) => s.reschedule)
              .map((s) => (
                <Card key={s.id} className="border-s-4 border-gold p-4">
                  <p className="text-sm font-bold text-ink">{getTeacher(s.teacherId).name} تطلب نقل الحصة</p>
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
                    <RescheduleRequest />
                  </div>
                </Card>
              ))}
          </section>
        )}

        <section className="space-y-3">
          <SectionTitle>الحصص القادمة</SectionTitle>
          {next.map((s) => {
            const start = new Date(s.startsAt);
            const teacher = getTeacher(s.teacherId);
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
                      <p className="font-bold text-ink">{getStudent(s.studentId)!.name}</p>
                      <Badge tone="gold" icon={<CalendarClock className="size-3.5" aria-hidden />}>
                        {s.durationMin} دقيقة
                      </Badge>
                    </div>
                    <p className="tabular mt-0.5 text-sm text-muted">
                      {fmtTimeRange(start, s.durationMin)} · {teacher.name}
                    </p>
                    <div className="mt-3">
                      <SessionActions
                        label={`${fmtWeekday(start)} ${fmtDayMonth(start)} · ${fmtTime(start)}`}
                        hoursBefore={hoursUntil(at, start)}
                        reschedulesUsed={1}
                        alternatives={['الاثنين 5:00 م', 'الأربعاء 4:00 م', 'الأربعاء 6:30 م', 'السبت 11:00 ص']}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>

        <section className="space-y-3">
          <SectionTitle>الحصص السابقة</SectionTitle>
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
          <p className="px-1 text-xs leading-5 text-muted">
            الإلغاء قبل 12 ساعة أو أكثر يعيد الرصيد، وبعدها أو الغياب دون إشعار يخصم الحصة. غياب المعلمة يوجب حصة تعويضية.
          </p>
        </section>
      </Page>
    </>
  );
}
