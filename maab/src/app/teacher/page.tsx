import { Bell, Clock, FilePen, Video } from 'lucide-react';
import type { Metadata } from 'next';
import { LogoHorizontal } from '@/components/brand/Brand';
import { NextSessionCard } from '@/components/features/NextSessionCard';
import { Page } from '@/components/shell/AppShell';
import { HeaderIconButton, WaveHeader } from '@/components/shell/WaveHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { cn } from '@/lib/cn';
import { joinState, reportDueAt } from '@/lib/domain/sessions';
import { dataset } from '@/lib/data';
import { arCount, fmtFullDate, fmtIn, fmtRelativeDay, fmtTime, fmtTimeRange, SESSIONS } from '@/lib/format';

export const metadata: Metadata = { title: 'لوحة المعلمة' };

export default async function TeacherHome() {
  const d = await dataset('teacher');
  const { teacherToday, teacherPendingReports, teacherStats } = d;
  const at = d.now();
  const me = d.me;
  const live = teacherToday.find((s) => joinState(at, new Date(s.startsAt), s.durationMin) === 'open');
  const next = live ?? teacherToday.find((s) => new Date(s.startsAt) > at);
  const pending = teacherPendingReports.map((p) => {
    const end = new Date(Date.parse(p.startsAt) + p.durationMin * 60_000);
    const due = reportDueAt(end);
    return { ...p, due, late: due < at };
  });

  const kpis = [
    { label: 'طالباتي وطلابي', value: teacherStats?.students ?? 0 },
    { label: 'ساعات آخر 30 يومًا', value: teacherStats?.hours30d ?? 0 },
    { label: 'نسبة الحضور', value: `%${teacherStats?.attendance ?? 100}` },
    { label: 'تقييم أولياء الأمور', value: teacherStats?.rating ?? '—' },
  ];

  return (
    <>
      <WaveHeader
        overlap
        start={<LogoHorizontal tone="hero" />}
        end={
          <HeaderIconButton href="/teacher/account" label="الإشعارات" badge={teacherStats?.unread}>
            <Bell className="size-6" />
          </HeaderIconButton>
        }
      >
        <div className="mt-3 space-y-1">
          <p className="text-2xl font-bold">حبابك، {me?.name ?? d.guardian.name}</p>
          <p className="text-sm text-on-hero/75">{fmtFullDate(at)}</p>
        </div>
        <div className="mt-4 flex gap-2 text-xs font-bold">
          <span className="rounded-full bg-white/10 px-3 py-1.5">{teacherToday.length ? `${arCount(teacherToday.length, SESSIONS)} اليوم` : 'لا حصص اليوم'}</span>
          {pending.some((p) => p.late) && <span className="rounded-full bg-danger/80 px-3 py-1.5 text-white">تقرير متأخر</span>}
        </div>
      </WaveHeader>

      <Page className="-mt-20">
        {next && (
          <NextSessionCard
            sessionId={next.id}
            who={next.student}
            note={next.focus}
            startsAt={new Date(next.startsAt)}
            durationMin={next.durationMin}
            now={at}
          />
        )}

        {pending.length > 0 && (
          <section className="space-y-3">
            <SectionTitle>تقارير لم تُكتب</SectionTitle>
            {pending.map((p) => (
              <Card key={p.sessionId} className={cn('flex items-center gap-3 border-s-4 p-3.5', p.late ? 'border-danger' : 'border-gold')}>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-ink">{p.student}</span>
                  <span className="tabular block text-xs text-muted">
                    {fmtRelativeDay(new Date(p.startsAt), at)} {fmtTime(new Date(p.startsAt))} ·{' '}
                    {p.late ? <b className="text-danger">تجاوز مهلة 12 ساعة</b> : `المهلة تنتهي ${fmtIn(at, p.due)}`}
                  </span>
                </span>
                <ButtonLink href={`/teacher/sessions/${p.sessionId}/report`} size="xs">
                  <FilePen className="size-3.5" aria-hidden />
                  اكتبي التقرير
                </ButtonLink>
              </Card>
            ))}
          </section>
        )}

        <section className="space-y-3">
          <SectionTitle>حصص اليوم</SectionTitle>
          {!teacherToday.length && <Card className="p-4 text-sm text-muted">ما في حصص اليوم. الله يديكِ العافية.</Card>}
          <ol className="relative space-y-3 before:absolute before:inset-y-3 before:start-[1.1rem] before:w-px before:bg-line">
            {teacherToday.map((s) => {
              const start = new Date(s.startsAt);
              const state = joinState(at, start, s.durationMin);
              const done = state === 'closed';
              return (
                <li key={s.id} className="relative flex gap-3">
                  <span
                    className={cn(
                      'relative z-10 mt-4 grid size-9 shrink-0 place-items-center rounded-full border-2 bg-card',
                      state === 'open' ? 'border-gold text-gold-text' : done ? 'border-brand bg-brand text-on-brand' : 'border-line text-muted',
                    )}
                    aria-hidden
                  >
                    {state === 'open' ? <Video className="size-4" /> : <Clock className="size-4" />}
                  </span>
                  <Card className={cn('flex-1 p-3.5', state === 'open' && 'ring-2 ring-gold/60')}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-ink">{s.student}</p>
                      {state === 'open' ? <Badge tone="gold">الآن</Badge> : <span className="tabular text-xs text-muted">{fmtTimeRange(start, s.durationMin)}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{s.category}</p>
                    <p className="mt-2 text-sm text-ink">{s.focus}</p>
                    <div className="mt-3 flex gap-2">
                      {state === 'open' && (
                        <ButtonLink href={`/sessions/${s.id}/join`} size="xs">
                          <Video className="size-3.5" aria-hidden />
                          ادخلي الحصة
                        </ButtonLink>
                      )}
                      <ButtonLink href={`/teacher/sessions/${s.id}/report`} size="xs" variant={state === 'open' ? 'soft' : 'ghost'}>
                        <FilePen className="size-3.5" aria-hidden />
                        التقرير
                      </ButtonLink>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="space-y-3">
          <SectionTitle>مؤشراتك</SectionTitle>
          <dl className="grid grid-cols-2 gap-3">
            {kpis.map((k) => (
              <Card key={k.label} className="p-3.5">
                <dt className="text-xs font-semibold text-muted">{k.label}</dt>
                <dd className="tabular mt-1 text-xl font-bold text-ink">{k.value}</dd>
              </Card>
            ))}
          </dl>
        </section>
      </Page>
    </>
  );
}
