import { Bell, BookOpenText, ChevronLeft, TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoHorizontal } from '@/components/brand/Brand';
import { ChildTabs, pickChild } from '@/components/features/ChildTabs';
import { NextSessionCard } from '@/components/features/NextSessionCard';
import { ReportCarousel, type ReportSlide } from '@/components/features/ReportCarousel';
import { Page } from '@/components/shell/AppShell';
import { HeaderIconButton, WaveHeader } from '@/components/shell/WaveHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { LOW_BALANCE } from '@/lib/domain/billing';
import { mastery, totalMistakes } from '@/lib/domain/mastery';
import { guardian } from '@/lib/demo/data';
import {
  childrenOf,
  getSession,
  getTeacher,
  juzProgress,
  memorizedTotal,
  now,
  reportMastery,
  reportsOf,
  segmentAyahs,
  unreadCount,
  upcoming,
} from '@/lib/demo/queries';
import { arCount, fmtDayMonth, fmtFullDate, fmtHijri, fmtRelativeDay, SESSIONS } from '@/lib/format';
import { ATTENDANCE_LABEL, SEGMENT_LABEL } from '@/lib/labels';
import { formatRange, surah } from '@/lib/quran';
import { pageOf } from '@/lib/quran/server';

export const metadata: Metadata = { title: 'الرئيسية' };

export default async function GuardianHome({ searchParams }: PageProps<'/guardian'>) {
  const { child: childParam } = await searchParams;
  const kids = childrenOf();
  const child = pickChild(kids, childParam);
  const at = now();
  const next = upcoming([child.id], at)[0];
  const teacher = getTeacher(child.teacherId);
  const slides: ReportSlide[] = reportsOf(child.id)
    .slice(0, 3)
    .map((r) => ({
      id: r.id,
      title: `تقرير ${fmtRelativeDay(new Date(getSession(r.sessionId)!.startsAt), at)}`,
      date: fmtDayMonth(new Date(getSession(r.sessionId)!.startsAt)),
      segments: r.segments.map((s) => ({
        label: SEGMENT_LABEL[s.type],
        range: formatRange(s.from, s.to),
        ayahs: segmentAyahs(s),
        mistakes: totalMistakes(s.mistakes),
        page: pageOf(s.from),
        memorized: mastery(s.mistakes) >= 70,
      })),
      mastery: reportMastery(r),
      grade: r.grade,
      attendance: ATTENDANCE_LABEL[r.attendance],
    }));
  const juz = juzProgress(child);
  const current = juz.find((j) => j.status === 'in_progress') ?? juz.find((j) => j.status === 'not_started')!;
  const homework = reportsOf(child.id)[0]?.homework.find((h) => h.type === 'new');
  const low = kids.filter((k) => k.subscription.remaining <= LOW_BALANCE);
  const greeting = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: 'numeric', hour12: false }).format(at)) < 12 ? 'صباح الخير' : 'مساء الخير';

  return (
    <>
      <WaveHeader
        overlap
        curve="swoosh"
        start={<LogoHorizontal tone="hero" />}
        end={
          <HeaderIconButton href="/guardian/notifications" label="الإشعارات" badge={unreadCount()}>
            <Bell className="size-6" />
          </HeaderIconButton>
        }
      >
        <div className="mt-3 space-y-1">
          <p className="text-2xl font-bold">
            {greeting}، {guardian.name.split(' ')[0]}
          </p>
          <p className="text-sm text-on-hero/75">
            {fmtFullDate(at)} · {fmtHijri(at)}
          </p>
        </div>
        <div className="mt-4">
          <ChildTabs items={kids} active={child.id} base="/guardian" />
        </div>
      </WaveHeader>

      <Page className="-mt-20">
        {next ? (
          <NextSessionCard
            sessionId={next.id}
            who={child.name}
            teacher={teacher.name}
            startsAt={new Date(next.startsAt)}
            durationMin={next.durationMin}
            now={at}
            manageHref={`/guardian/schedule?child=${child.id}`}
          />
        ) : (
          <Card className="p-4 text-sm text-muted">لا حصص مجدولة. اختاري باقة لتبدأ الحصص.</Card>
        )}

        {low.map((k) => (
          <div key={k.id} className="flex items-center gap-3 rounded-card border border-warning/30 bg-warning/8 p-3.5">
            <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden />
            <p className="flex-1 text-sm text-ink">
              بقيت <b>{arCount(k.subscription.remaining, SESSIONS)}</b> في باقة {k.name}، تنتهي {fmtDayMonth(new Date(k.subscription.expiresAt))}.
            </p>
            <ButtonLink href={`/guardian/plans?child=${k.id}`} size="xs" variant="soft">
              جدّدي
            </ButtonLink>
          </div>
        ))}

        <section className="space-y-3">
          <SectionTitle
            action={
              <Link href={`/guardian/progress?child=${child.id}`} className="text-xs font-bold text-brand">
                كل التقارير
              </Link>
            }
          >
            آخر الحصص
          </SectionTitle>
          {slides.length ? <ReportCarousel slides={slides} /> : <Card className="p-4 text-sm text-muted">لا تقارير بعد.</Card>}
        </section>

        <section className="space-y-3">
          <SectionTitle>خطة الحفظ</SectionTitle>
          <Link href={`/guardian/progress/map?child=${child.id}`} className="block">
            <Card className="p-4 transition hover:shadow-lift">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-ink">الجزء {current.juz}</p>
                  <p className="text-xs text-muted">
                    {child.plan.direction === 'nas_to_baqarah' ? 'من الناس إلى البقرة' : 'من البقرة إلى الناس'} · الهدف{' '}
                    {child.plan.weeklyTarget} آية أسبوعيًا
                  </p>
                </div>
                <span className="tabular text-2xl font-bold text-brand">%{current.percent}</span>
              </div>
              <ProgressBar value={current.percent} label={`تقدّم الجزء ${current.juz}`} className="mt-3" />
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>
                  المحفوظ: <b className="tabular text-ink">{memorizedTotal(child)}</b> آية · {juz.filter((j) => j.status === 'memorized').length}{' '}
                  جزء مكتمل
                </span>
                <span className="flex items-center gap-1 font-bold text-brand">
                  الخريطة <ChevronLeft className="size-3.5" aria-hidden />
                </span>
              </div>
            </Card>
          </Link>
        </section>

        {homework && (
          <section className="space-y-3">
            <SectionTitle>الواجب للحصة القادمة</SectionTitle>
            <Link
              href={`/guardian/mushaf/${pageOf(homework.from)}`}
              className="flex items-center gap-3 rounded-card bg-brand p-4 text-on-brand shadow-card transition hover:bg-brand-soft"
            >
              <span className="grid size-11 place-items-center rounded-ctl bg-white/12 text-gold" aria-hidden>
                <BookOpenText className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-bold">حفظ {formatRange(homework.from, homework.to)}</span>
                <span className="block text-xs opacity-80">
                  سورة {surah(homework.from.surah).name} · الصفحة {pageOf(homework.from)} — افتحيه في المصحف
                </span>
              </span>
              <ChevronLeft className="size-5 opacity-80" aria-hidden />
            </Link>
          </section>
        )}
      </Page>
    </>
  );
}
