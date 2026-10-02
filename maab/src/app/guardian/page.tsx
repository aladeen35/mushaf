import { Bell, ChevronLeft, TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoHorizontal } from '@/components/brand/Brand';
import { ChildPanels, ChildTabs } from '@/components/features/ChildTabs';
import { NextSessionCard } from '@/components/features/NextSessionCard';
import { ReportCarousel, type ReportSlide } from '@/components/features/ReportCarousel';
import { Page } from '@/components/shell/AppShell';
import { HeaderIconButton, WaveHeader } from '@/components/shell/WaveHeader';
import { Lawh, LawhLine } from '@/components/sudan/Lawh';
import { SharafaCard } from '@/components/sudan/Sharafa';
import { ButtonLink } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { dataset, type Dataset } from '@/lib/data';
import { LOW_BALANCE } from '@/lib/domain/billing';
import { mastery, totalMistakes } from '@/lib/domain/mastery';
import { arCount, fmtDayMonth, fmtFullDate, fmtHijri, fmtRelativeDay, localHour, SESSIONS } from '@/lib/format';
import { ATTENDANCE_LABEL, SEGMENT_LABEL } from '@/lib/labels';
import { formatRange } from '@/lib/quran';
import { JUZ_NAMES, juzOrdinal } from '@/lib/quran/names';
import { pageOf } from '@/lib/quran/server';
import type { Student } from '@/lib/types';

export const metadata: Metadata = { title: 'الرئيسية' };

const DAY = 86_400_000;

export default async function GuardianHome() {
  const d = await dataset('guardian');
  const kids = d.childrenOf();
  const at = d.now();
  const greeting = localHour(at) < 12 ? 'صباح الخير' : 'مساء الخير';

  return (
    <>
      <WaveHeader
        overlap
        curve="swoosh"
        start={<LogoHorizontal tone="hero" />}
        end={
          <HeaderIconButton href="/guardian/notifications" label="الإشعارات" badge={d.unreadCount()}>
            <Bell className="size-6" />
          </HeaderIconButton>
        }
      >
        <div className="mt-3 space-y-1">
          <p className="text-2xl font-bold">
            {greeting}، {d.guardian.name.split(' ')[0]}
          </p>
          <p className="text-sm text-on-hero/75">
            {fmtFullDate(at)} · {fmtHijri(at)}
          </p>
        </div>
        <div className="mt-4">
          <ChildTabs items={kids} base="/guardian" />
        </div>
      </WaveHeader>

      <Page className="-mt-20">
        {kids.length ? (
          <ChildPanels panels={Object.fromEntries(kids.map((k) => [k.id, <ChildHome key={k.id} d={d} child={k} kids={kids} />]))} />
        ) : (
          <Card className="space-y-3 p-5 text-center">
            <p className="font-display text-xl font-bold text-brand">حبابكم في مآب</p>
            <p className="text-sm leading-7 text-muted">أضيفي ابنكِ أو ابنتكِ أولاً، ثم اختاري المعلمة والأوقات.</p>
            <ButtonLink href="/guardian/children/new" block>
              إضافة ابن أو ابنة
            </ButtonLink>
          </Card>
        )}
      </Page>
    </>
  );
}

function ChildHome({ d, child, kids }: { d: Dataset; child: Student; kids: Student[] }) {
  const at = d.now();
  const next = d.upcoming([child.id], at)[0];
  const teacher = d.getTeacher(child.teacherId);
  const reports = d.reportsOf(child.id);
  const slides: ReportSlide[] = reports.slice(0, 3).map((r) => {
    const when = d.reportSessionDate(r);
    return {
      id: r.id,
      title: `تقرير ${fmtRelativeDay(when, at)}`,
      date: fmtDayMonth(when),
      segments: r.segments.map((s) => ({
        label: SEGMENT_LABEL[s.type],
        range: formatRange(s.from, s.to),
        ayahs: d.segmentAyahs(s),
        mistakes: totalMistakes(s.mistakes),
        page: pageOf(s.from),
        memorized: mastery(s.mistakes) >= 70,
      })),
      mastery: d.reportMastery(r),
      grade: r.grade,
      attendance: ATTENDANCE_LABEL[r.attendance],
    };
  });
  const juz = d.juzProgress(child);
  const current = juz.find((j) => j.status === 'in_progress') ?? juz.find((j) => j.status === 'not_started') ?? juz[29];
  const homework = reports[0]?.homework ?? [];
  const low = kids.filter((k) => k.subscription && k.subscription.remaining <= LOW_BALANCE);
  // الشرافة: تهنئة إتمام جزء خلال الأسبوعين الماضيين
  const sharafa = d.notifications.find(
    (n) => n.kind === 'sharafa' && n.meta?.studentId === child.id && n.meta.juz && at.getTime() - Date.parse(n.at) < 14 * DAY,
  );

  return (
    <div className="space-y-6">
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
        <Card className="flex items-center gap-3 p-4">
          <p className="flex-1 text-sm text-muted">لسه ما في حصص مجدولة لـ{child.name}. اختاري باقة لتبدأ الحصص.</p>
          <ButtonLink href={`/guardian/plans?child=${child.id}`} size="xs">
            الباقات
          </ButtonLink>
        </Card>
      )}

      {sharafa?.meta?.juz && (
        <Link href={`/guardian/progress/map?child=${child.id}`} className="block transition hover:-translate-y-0.5">
          <SharafaCard juz={`${juzOrdinal(sharafa.meta.juz)} (${JUZ_NAMES[sharafa.meta.juz - 1]})`} student={child.name} female={child.gender === 'female'} />
        </Link>
      )}

      {low.map((k) => (
        <div key={k.id} className="flex items-center gap-3 rounded-card border border-warning/30 bg-warning/8 p-3.5">
          <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="flex-1 text-sm text-ink">
            بقيت <b>{arCount(k.subscription!.remaining, SESSIONS)}</b> في باقة {k.name}، تنتهي {fmtDayMonth(new Date(k.subscription!.expiresAt))}.
          </p>
          <ButtonLink href={`/guardian/plans?child=${k.id}`} size="xs" variant="soft">
            جدّدي
          </ButtonLink>
        </div>
      ))}

      {homework.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>الواجب للحصة القادمة</SectionTitle>
          <Link href={`/guardian/mushaf/${pageOf(homework[0].from)}`} className="block transition hover:-translate-y-0.5">
            <Lawh
              label={`لوح ${child.name}`}
              footer={
                <span className="flex items-center justify-between font-semibold">
                  <span>
                    الصفحة {pageOf(homework[0].from)} · افتحي المصحف وراجعيه مع {child.gender === 'female' ? 'بنتك' : 'ولدك'}
                  </span>
                  <ChevronLeft className="size-4" aria-hidden />
                </span>
              }
            >
              {homework.map((h) => (
                <LawhLine key={`${h.type}-${h.from.surah}-${h.from.ayah}`} kind={SEGMENT_LABEL[h.type]}>
                  {formatRange(h.from, h.to)}
                </LawhLine>
              ))}
            </Lawh>
          </Link>
        </section>
      )}

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
        {slides.length ? <ReportCarousel slides={slides} /> : <Card className="p-4 text-sm text-muted">لسه ما في تقارير؛ تصل بعد أول حصة.</Card>}
      </section>

      <section className="space-y-3">
        <SectionTitle>خطة الحفظ</SectionTitle>
        <Link href={`/guardian/progress/map?child=${child.id}`} className="block">
          <Card className="p-4 transition hover:shadow-lift">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-ink">الجزء {current.juz}</p>
                <p className="text-xs text-muted">
                  {child.plan.direction === 'nas_to_baqarah' ? 'من الناس إلى البقرة' : 'من البقرة إلى الناس'} · الهدف {child.plan.weeklyTarget} آية
                  أسبوعيًا
                </p>
              </div>
              <span className="tabular text-2xl font-bold text-brand">%{current.percent}</span>
            </div>
            <ProgressBar value={current.percent} label={`تقدّم الجزء ${current.juz}`} className="mt-3" />
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>
                المحفوظ: <b className="tabular text-ink">{d.memorizedTotal(child)}</b> آية · {juz.filter((j) => j.status === 'memorized').length} جزء مكتمل
              </span>
              <span className="flex items-center gap-1 font-bold text-brand">
                الخريطة <ChevronLeft className="size-3.5" aria-hidden />
              </span>
            </div>
          </Card>
        </Link>
      </section>
    </div>
  );
}
