import { ChevronDown, ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChildTabs, pickChild } from '@/components/features/ChildTabs';
import { ProgressTabs } from '@/components/features/ProgressTabs';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { BarChart, Ring } from '@/components/ui/Progress';
import { gradeLabel } from '@/lib/domain/mastery';
import { monthlyAyahs } from '@/lib/demo/data';
import {
  attendanceRate,
  childrenOf,
  juzProgress,
  memorizedTotal,
  reportMastery,
  reportSessionDate,
  reportsOf,
} from '@/lib/demo/queries';
import { arCount, fmtAyahs, fmtDayMonth, fmtWeekday } from '@/lib/format';
import { SEGMENT_LABEL } from '@/lib/labels';
import { formatRange } from '@/lib/quran';

export const metadata: Metadata = { title: 'الحفظ' };

export default async function Progress({ searchParams }: PageProps<'/guardian/progress'>) {
  const { child: childParam } = await searchParams;
  const kids = childrenOf();
  const child = pickChild(kids, childParam);
  const months = monthlyAyahs[child.id];
  const target = child.plan.weeklyTarget * 4;
  const done = months.at(-1)!.value;
  const rs = reportsOf(child.id);
  const avg = rs.length ? Math.round(rs.reduce((n, r) => n + reportMastery(r), 0) / rs.length) : 0;
  const juz = juzProgress(child);

  const tiles = [
    { label: 'المحفوظ', value: memorizedTotal(child), unit: 'آية' },
    { label: 'أجزاء مكتملة', value: juz.filter((j) => j.status === 'memorized').length, unit: 'جزء' },
    { label: 'متوسط الإتقان', value: `%${avg}`, unit: '' },
    { label: 'الحضور', value: `%${attendanceRate(child.id)}`, unit: '' },
  ];

  return (
    <>
      <WaveHeader title="الحفظ والتقدّم" back="/guardian">
        <div className="flex justify-center pt-1 pb-2">
          <ChildTabs items={kids} active={child.id} base="/guardian/progress" />
        </div>
      </WaveHeader>

      <Page className="-mt-6">
        <ProgressTabs active="stats" child={child.id} />

        <Card className="flex items-center gap-4 bg-gradient-to-l from-gold/14 to-card p-4">
          <Ring value={(done / target) * 100} label="إنجاز الهدف الشهري" size={104} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-bold text-ink">إنجاز هدف الشهر</p>
            <p className="flex justify-between text-sm">
              <span className="text-muted">المطلوب</span>
              <span className="tabular font-bold text-ink">{fmtAyahs(target)}</span>
            </p>
            <p className="flex justify-between text-sm">
              <span className="text-muted">المنجز</span>
              <span className="tabular font-bold text-ink">{fmtAyahs(done)}</span>
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-ink">كمية الحفظ الجديد</h2>
            <span className="flex items-center gap-1 rounded-lg bg-field px-2.5 py-1 text-xs font-semibold text-muted">
              آخر 6 أشهر <ChevronDown className="size-3.5" aria-hidden />
            </span>
          </div>
          <BarChart data={months.map((m) => ({ label: m.month, value: m.value }))} unit="آية" legend="الآيات المحفوظة" />
        </Card>

        <dl className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <Card key={t.label} className="p-3.5">
              <dt className="text-xs font-semibold text-muted">{t.label}</dt>
              <dd className="tabular mt-1 text-xl font-bold text-ink">
                {t.value} {t.unit && <span className="text-xs font-semibold text-muted">{t.unit}</span>}
              </dd>
            </Card>
          ))}
        </dl>

        <section className="space-y-3">
          <SectionTitle>سجل التقارير</SectionTitle>
          <Card className="divide-y divide-line">
            {rs.map((r) => {
              const d = reportSessionDate(r);
              const m = reportMastery(r);
              const first = r.segments[0];
              return (
                <Link key={r.id} href={`/guardian/reports/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-field">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">
                      {fmtWeekday(d)} {fmtDayMonth(d)}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {SEGMENT_LABEL[first.type]}: {formatRange(first.from, first.to)}
                      {r.segments.length > 1 && ` و${arCount(r.segments.length - 1, ['مقطع آخر', 'مقطعان آخران', 'مقاطع أخرى', 'مقطعًا آخر'])}`}
                    </span>
                  </span>
                  <Badge tone={m >= 90 ? 'success' : m >= 70 ? 'gold' : 'danger'}>
                    {gradeLabel(r.grade)} · %{Math.round(m)}
                  </Badge>
                  <ChevronLeft className="size-4 text-muted" aria-hidden />
                </Link>
              );
            })}
          </Card>
        </section>
      </Page>
    </>
  );
}
