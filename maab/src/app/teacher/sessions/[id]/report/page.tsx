import { Timer } from 'lucide-react';
import type { Metadata } from 'next';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { NO_MISTAKES } from '@/lib/domain/mastery';
import { reportDueAt } from '@/lib/domain/sessions';
import { teacherPendingReports, teacherToday } from '@/lib/demo/data';
import { getStudent, now, reportsOf } from '@/lib/demo/queries';
import { fmtIn, fmtRelativeDay, fmtTime } from '@/lib/format';
import { ReportForm } from './ReportForm';

export const metadata: Metadata = { title: 'تقرير الحصة' };

export default async function TeacherReport({ params }: PageProps<'/teacher/sessions/[id]/report'>) {
  const { id } = await params;
  const at = now();
  const s = [...teacherToday, ...teacherPendingReports.map((p) => ({ ...p, id: p.sessionId }))].find((x) => x.id === id) ?? teacherToday[0];
  const start = new Date(s.startsAt);
  const due = reportDueAt(new Date(start.getTime() + s.durationMin * 60_000));

  // يُملأ التقرير مسبقاً من واجب الحصة السابقة إن وُجد، فتبقى أقل من دقيقتين للكتابة
  const reem = getStudent('s1')!;
  const last = id === 'x04' ? reportsOf(reem.id)[0] : undefined;
  const initial = last
    ? last.homework.map((h) => ({ type: h.type, from: h.from, to: h.to, mistakes: NO_MISTAKES }))
    : [{ type: 'new' as const, from: { surah: 3, ayah: 92 }, to: { surah: 3, ayah: 101 }, mistakes: NO_MISTAKES }];

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
        <ReportForm student={s.student} initial={initial} backHref="/teacher" />
      </Page>
    </>
  );
}
