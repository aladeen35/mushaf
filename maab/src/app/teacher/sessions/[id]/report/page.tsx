import { Timer } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { NO_MISTAKES } from '@/lib/domain/mastery';
import { reportDueAt } from '@/lib/domain/sessions';
import { dataset, IS_LIVE, LIVE_PROBE } from '@/lib/data';
import { demoDataset } from '@/lib/data/demo';
import { fmtIn, fmtRelativeDay, fmtTime } from '@/lib/format';
import { ReportForm } from './ReportForm';

export const metadata: Metadata = { title: 'تقرير الحصة' };

export function generateStaticParams() {
  return IS_LIVE ? [{ id: LIVE_PROBE }] : [...demoDataset.teacherToday.map((s) => ({ id: s.id })), ...demoDataset.teacherPendingReports.map((p) => ({ id: p.sessionId }))];
}

export default async function TeacherReport({ params }: PageProps<'/teacher/sessions/[id]/report'>) {
  const { id } = await params;
  const d = await dataset('teacher');
  const at = d.now();
  const today = d.teacherToday.find((x) => x.id === id);
  const pending = d.teacherPendingReports.find((x) => x.sessionId === id);
  const session = d.getSession(id);
  const studentId = today?.studentId ?? pending?.studentId ?? session?.studentId;
  const base = today ?? pending ?? session;
  if (!studentId || !base) notFound();
  const student = d.getStudent(studentId);
  const s = { student: today?.student ?? pending?.student ?? student?.fullName ?? '', startsAt: base.startsAt, durationMin: base.durationMin };
  const start = new Date(s.startsAt);
  const due = reportDueAt(new Date(start.getTime() + s.durationMin * 60_000));

  // يُملأ التقرير مسبقاً من واجب الحصة السابقة إن وُجد، فتبقى أقل من دقيقتين للكتابة
  const last = d.reportsOf(studentId)[0];
  const current = today?.current ?? student?.current ?? { from: { surah: 114, ayah: 1 }, to: { surah: 114, ayah: 6 } };
  const initial = last?.homework.length
    ? last.homework.map((h) => ({ type: h.type, from: h.from, to: h.to, mistakes: NO_MISTAKES }))
    : [{ type: 'new' as const, from: current.from, to: current.to, mistakes: NO_MISTAKES }];

  return (
    <>
      <WaveHeader title="تقرير الحصة" back="/teacher">
        <div className="pb-2 text-center">
          <p className="text-lg font-bold">{s.student}</p>
          <p className="tabular text-sm text-on-hero/80">
            {fmtRelativeDay(start, at)} {fmtTime(start)} · {s.durationMin} دقيقة
          </p>
        </div>
      </WaveHeader>
      <Page className="-mt-4">
        <p className="flex items-center gap-2 rounded-ctl bg-gold/12 px-3 py-2 text-xs font-semibold text-gold-text">
          <Timer className="size-4 shrink-0" aria-hidden />
          {due > at ? `يُكتب خلال 12 ساعة من نهاية الحصة — تنتهي المهلة ${fmtIn(at, due)}` : 'تجاوز التقرير مهلة 12 ساعة، ويُسجَّل متأخرًا'}
        </p>
        <ReportForm sessionId={id} student={s.student} direction={student?.plan.direction ?? 'nas_to_baqarah'} initial={initial} backHref="/teacher" />
      </Page>
    </>
  );
}
