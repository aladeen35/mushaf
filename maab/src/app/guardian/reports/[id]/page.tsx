import { ChevronLeft, Quote } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Lawh, LawhLine } from '@/components/sudan/Lawh';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { ProgressBar, Ring } from '@/components/ui/Progress';
import { gradeLabel, mastery, MEMORIZED_THRESHOLD } from '@/lib/domain/mastery';
import { dataset, IS_LIVE, LIVE_PROBE } from '@/lib/data';
import { demoDataset } from '@/lib/data/demo';
import { fmtAyahs, fmtFullDate } from '@/lib/format';
import { ATTENDANCE_LABEL, SEGMENT_LABEL } from '@/lib/labels';
import { formatRange } from '@/lib/quran';
import { pageOf } from '@/lib/quran/server';

export const metadata: Metadata = { title: 'تقرير الحصة' };

export function generateStaticParams() {
  return IS_LIVE ? [{ id: LIVE_PROBE }] : demoDataset.reports.map((r) => ({ id: r.id }));
}

const MISTAKE_KINDS = [
  { key: 'hifz', label: 'حفظ' },
  { key: 'tajweed', label: 'تجويد' },
  { key: 'tashkeel', label: 'تشكيل' },
  { key: 'hesitation', label: 'تردد' },
] as const;

export default async function ReportPage({ params }: PageProps<'/guardian/reports/[id]'>) {
  const { id } = await params;
  const d = await dataset('guardian');
  const r = d.getReport(id);
  const student = r && d.getStudent(r.studentId);
  if (!r || !student) notFound();
  const teacher = d.getTeacher(r.teacherId);
  const m = d.reportMastery(r);

  return (
    <>
      <WaveHeader title="تقرير الحصة" back={`/guardian/progress?child=${student.id}`}>
        <p className="pb-2 text-center text-sm text-on-hero/80">
          {student.name} · {fmtFullDate(d.reportSessionDate(r))}
        </p>
      </WaveHeader>

      <Page className="-mt-4">
        <Card className="flex items-center gap-4 p-4">
          <Ring value={m} label="الإتقان" size={92} stroke={10} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-lg font-bold text-ink">{r.grade ? gradeLabel(r.grade) : ATTENDANCE_LABEL[r.attendance]}</p>
            <p className="text-sm text-muted">{teacher.name}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={r.attendance === 'present' ? 'success' : r.attendance === 'late' ? 'warning' : 'danger'}>
                {ATTENDANCE_LABEL[r.attendance]}
              </Badge>
              <Badge tone="gold">{fmtAyahs(r.segments.reduce((n, s) => n + d.segmentAyahs(s), 0), true)}</Badge>
            </div>
          </div>
        </Card>

        <section className="space-y-3">
          <SectionTitle>المقاطع</SectionTitle>
          {r.segments.map((s, i) => {
            const sm = mastery(s.mistakes);
            const ok = sm >= MEMORIZED_THRESHOLD;
            return (
              <Card key={i} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-ink">
                    <span className="text-gold-text">{SEGMENT_LABEL[s.type]}</span> · {formatRange(s.from, s.to)}
                  </p>
                  <Badge tone={ok ? 'success' : 'danger'}>{ok ? 'محتسب' : 'يعود في الواجب'}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar value={sm} label={`إتقان المقطع ${i + 1}`} />
                  <span className="tabular shrink-0 text-sm font-bold text-ink">%{sm}</span>
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                  {MISTAKE_KINDS.map((k) => (
                    <div key={k.key} className="rounded-ctl bg-field py-2">
                      <dt className="text-[11px] text-muted">{k.label}</dt>
                      <dd className={`tabular text-base font-bold ${s.mistakes[k.key] ? 'text-danger' : 'text-ink'}`}>{s.mistakes[k.key]}</dd>
                    </div>
                  ))}
                </dl>
                <Link href={`/guardian/mushaf/${pageOf(s.from)}`} className="mt-3 flex items-center justify-end gap-1 text-xs font-bold text-brand">
                  في المصحف · صفحة {pageOf(s.from)} <ChevronLeft className="size-3.5" aria-hidden />
                </Link>
              </Card>
            );
          })}
          <p className="px-1 text-[11px] leading-5 text-muted">
            الإتقان = 100 − (3 لكل خطأ حفظ + 1 لكل خطأ تجويد أو تشكيل + 0.5 لكل تردد)، والمقطع تحت %{MEMORIZED_THRESHOLD} لا يُحتسب محفوظًا.
          </p>
        </section>

        {r.internalNote && (
          <section className="space-y-3">
            <SectionTitle>ملاحظة داخلية</SectionTitle>
            <Card className="p-4 text-sm leading-7 text-ink">{r.internalNote}</Card>
          </section>
        )}

        <section className="space-y-3 empty:hidden">
          {r.guardianNote && <SectionTitle>ملاحظة المعلمة</SectionTitle>}
          {r.guardianNote && (
            <Card className="relative border-s-4 border-gold p-4 ps-5">
              <Quote className="absolute end-3 top-3 size-6 text-gold/40" aria-hidden />
              <p className="leading-7 text-ink">{r.guardianNote}</p>
            </Card>
          )}
        </section>

        {r.homework.length > 0 && (
          <section className="space-y-3">
            <SectionTitle>الواجب للحصة القادمة</SectionTitle>
            <Lawh
              label={`لوح ${student.name}`}
              footer={
                <span className="flex flex-wrap gap-x-4 gap-y-1">
                  {r.homework.map((h) => (
                    <Link key={`${h.from.surah}-${h.from.ayah}`} href={`/guardian/mushaf/${pageOf(h.from)}`} className="flex items-center gap-1 font-bold underline-offset-4 hover:underline">
                      {SEGMENT_LABEL[h.type]} · صفحة {pageOf(h.from)} <ChevronLeft className="size-3.5" aria-hidden />
                    </Link>
                  ))}
                </span>
              }
            >
              {r.homework.map((h) => (
                <LawhLine key={`${h.type}-${h.from.surah}-${h.from.ayah}`} kind={SEGMENT_LABEL[h.type]}>
                  {formatRange(h.from, h.to)}
                </LawhLine>
              ))}
            </Lawh>
          </section>
        )}
      </Page>
    </>
  );
}
