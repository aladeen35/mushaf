import { CalendarSync, ChevronLeft, ClipboardX, Receipt, UserCheck, UserX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { BarChart } from '@/components/ui/Progress';
import { FLAGS } from '@/lib/flags';
import { adminKpis, adminQueue, riyadh } from '@/lib/demo/data';
import { now } from '@/lib/demo/queries';
import { formatMoney, type Currency } from '@/lib/domain/market';
import { fmtFullDate, fmtRelativeDay, fmtTime } from '@/lib/format';

export const metadata: Metadata = { title: 'لوحة اليوم' };

const QUEUE = [
  { key: 'payments', label: 'تحويلات للاعتماد', icon: Receipt, href: '/admin/payments', tone: 'text-warning bg-warning/12' },
  { key: 'applications', label: 'معلمات للمراجعة', icon: UserCheck, href: '/admin/teachers', tone: 'text-brand bg-brand/10' },
  { key: 'reschedules', label: 'طلبات إعادة جدولة', icon: CalendarSync, href: '/admin#schedule', tone: 'text-gold-text bg-gold/14' },
  { key: 'unassigned', label: 'حصص اليوم بلا معلمة', icon: UserX, href: '/admin#schedule', tone: 'text-danger bg-danger/10' },
  { key: 'lateReports', label: 'تقارير متأخرة', icon: ClipboardX, href: '/admin#schedule', tone: 'text-danger bg-danger/10' },
] as const;

const AUDIT = [
  { who: 'المالية · ريم الشهري', what: 'اعتمدت التحويل MAAB-2026-000141 وفعّلت باقة «منتظمة»', at: riyadh('2026-10-04', '12:52') },
  { who: 'المشرفة · منيرة العتيبي', what: 'أسندت الطالبة جود الحربي إلى أ. هند القحطاني', at: riyadh('2026-10-04', '11:30') },
  { who: 'الدعم · سارا القحطاني', what: 'دخلت بحساب ولي أمر بإذن مسجّل — السبب: تعذّر رفع الإيصال', at: riyadh('2026-10-04', '10:05') },
  { who: 'المالية · ريم الشهري', what: 'طلبت تصحيح الإيصال MAAB-2026-000139: المبلغ غير مطابق', at: riyadh('2026-10-03', '21:14') },
];

export default function AdminHome() {
  const at = now();
  const kpis = [
    { label: 'الطلاب النشطون', value: adminKpis.activeStudents },
    { label: 'المعلمات', value: adminKpis.teachers },
    { label: 'الاشتراكات النشطة', value: adminKpis.activeSubscriptions },
    { label: 'تنتهي هذا الأسبوع', value: adminKpis.endingThisWeek },
    { label: 'إيرادات الشهر', value: (Object.entries(adminKpis.revenueMonth) as [Currency, number][]).map(([c, n]) => formatMoney(n, c)).join(' · ') },
    { label: 'نسبة الحضور', value: `%${adminKpis.attendance}` },
  ];
  const flags = Object.entries(FLAGS);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-ink">لوحة اليوم</h1>
          <p className="text-sm text-muted">{fmtFullDate(at)} · بتوقيت الرياض</p>
        </div>
        <Badge tone="gold">نسخة العرض</Badge>
      </div>

      <section className="space-y-3">
        <SectionTitle>تحتاج إجراءً الآن</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {QUEUE.map(({ key, label, icon: Icon, href, tone }) => (
            <Link key={key} href={href} className="group rounded-card bg-card p-4 shadow-card transition hover:shadow-lift">
              <span className={`grid size-10 place-items-center rounded-ctl ${tone}`} aria-hidden>
                <Icon className="size-5" />
              </span>
              <p className="tabular mt-3 text-3xl font-bold text-ink">{adminQueue[key]}</p>
              <p className="mt-0.5 flex items-center justify-between text-xs font-semibold text-muted">
                {label}
                <ChevronLeft className="size-4 transition group-hover:-translate-x-0.5" aria-hidden />
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>المؤشرات</SectionTitle>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((k) => (
            <Card key={k.label} className="p-4">
              <dt className="text-xs font-semibold text-muted">{k.label}</dt>
              <dd className="tabular mt-1 text-xl font-bold text-ink">{k.value}</dd>
            </Card>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section id="schedule" className="space-y-3">
          <SectionTitle>الحصص المنفّذة أسبوعيًا</SectionTitle>
          <Card className="p-4">
            <BarChart
              legend="حصص مكتملة"
              unit="حصة"
              data={[
                { label: '30 أغس', value: 512 },
                { label: '6 سبت', value: 548 },
                { label: '13 سبت', value: 571 },
                { label: '20 سبت', value: 603 },
                { label: '27 سبت', value: 640 },
                { label: 'هذا الأسبوع', value: 188 },
              ]}
            />
          </Card>
        </section>

        <section id="audit" className="space-y-3">
          <SectionTitle>سجل التدقيق</SectionTitle>
          <Card className="divide-y divide-line">
            {AUDIT.map((a, i) => (
              <div key={i} className="px-4 py-3">
                <p className="flex justify-between gap-2 text-xs text-muted">
                  <span className="font-bold text-gold-text">{a.who}</span>
                  <span className="tabular">
                    {fmtRelativeDay(new Date(a.at), at)} {fmtTime(new Date(a.at))}
                  </span>
                </p>
                <p className="mt-1 text-sm text-ink">{a.what}</p>
              </div>
            ))}
            <p className="px-4 py-2.5 text-[11px] text-muted">السجل غير قابل للتعديل ويُحفظ 3 سنوات.</p>
          </Card>
        </section>
      </div>

      <section id="settings" className="space-y-3">
        <SectionTitle>التفعيل التدريجي للمرحلة الثانية</SectionTitle>
        <Card className="grid gap-x-6 gap-y-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {flags.map(([k, on]) => (
            <div key={k} className="flex items-center justify-between rounded-ctl bg-field px-3 py-2.5">
              <code dir="ltr" className="text-xs text-ink">
                {k}
              </code>
              <Badge tone={on ? 'success' : 'neutral'}>{on ? 'مفعّلة' : 'غير مفعّلة'}</Badge>
            </div>
          ))}
        </Card>
      </section>
    </>
  );
}
