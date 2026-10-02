import { ArrowLeft, CalendarClock, CircleAlert, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { cn } from '@/lib/cn';
import { APPLICATION_FLOW, APPLICATION_STATUS, REAPPLY_AFTER_DAYS, TEACHER_DOCUMENTS, type ApplicationStatus } from '@/lib/domain/teachers';
import { dataset } from '@/lib/data';
import { arCount, fmtDayMonth, fmtRelativeDay, fmtTime, YEARS } from '@/lib/format';
import { ApplicationActions } from './ApplicationActions';

export const metadata: Metadata = { title: 'طلبات المعلمات' };

const COLUMNS: ApplicationStatus[] = ['new', 'under_review', 'needs_info', 'interview', 'accepted', 'rejected'];

export default async function AdminTeachers() {
  const d = await dataset('admin');
  const { applications } = d;
  const at = d.now();
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-ink">مسار قبول المعلمات</h1>
        <p className="mt-1 text-sm text-muted">لا تظهر المعلمة للطلاب ولا تُسند إليها حصص إلا بعد المراجعة ومقابلة التسميع.</p>
      </div>

      <Card className="overflow-x-auto p-4">
        <ol className="flex min-w-max items-center gap-2 text-xs font-bold" aria-label="مراحل الطلب">
          {APPLICATION_FLOW.map((s, i, all) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-ctl border px-3 py-2',
                  s === 'accepted' ? 'border-brand bg-brand text-on-brand' : 'border-line bg-card text-ink',
                )}
              >
                {APPLICATION_STATUS[s].label}
              </span>
              {i < all.length - 1 && <ArrowLeft className="size-4 text-gold-text" aria-hidden />}
            </li>
          ))}
          <li className="ms-4 flex items-center gap-2 text-muted">
            <span className="rounded-ctl border border-warning/40 bg-warning/8 px-3 py-2 text-warning">يحتاج معلومات ↺</span>
            <span className="rounded-ctl border border-danger/40 bg-danger/6 px-3 py-2 text-danger">مرفوضة مع السبب</span>
          </li>
        </ol>
        <p className="mt-3 text-[11px] text-muted">يحق للمرفوضة التقديم مجددًا بعد {REAPPLY_AFTER_DAYS} يومًا، ويُرسل لها سبب الرفض.</p>
      </Card>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
        <div className="grid min-w-[960px] grid-cols-6 gap-3">
          {COLUMNS.map((col) => {
            const items = applications.filter((a) => a.status === col);
            const st = APPLICATION_STATUS[col];
            return (
              <section key={col} aria-label={st.label} className="space-y-2 rounded-card bg-sunken/60 p-2.5">
                <h2 className="flex items-center justify-between px-1 text-sm font-bold text-ink">
                  {st.label}
                  <Badge tone={st.tone}>{items.length}</Badge>
                </h2>
                {items.map((a) => (
                  <Card key={a.id} className="space-y-1.5 p-3">
                    <p className="font-bold text-ink">{a.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <MapPin className="size-3.5" aria-hidden />
                      {a.city} · {a.riwayah}
                    </p>
                    {a.experienceYears > 0 && <p className="text-xs text-muted">خبرة {arCount(a.experienceYears, YEARS)}</p>}
                    {a.missing && (
                      <p className="flex items-start gap-1 rounded-lg bg-warning/10 p-1.5 text-[11px] font-semibold text-warning">
                        <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {a.missing}
                      </p>
                    )}
                    {a.interviewAt && (
                      <p className="flex items-center gap-1 rounded-lg bg-brand/8 p-1.5 text-[11px] font-semibold text-brand">
                        <CalendarClock className="size-3.5" aria-hidden />
                        {fmtRelativeDay(new Date(a.interviewAt), at)} {fmtTime(new Date(a.interviewAt))}
                      </p>
                    )}
                    <p className="text-[11px] text-muted">قُدّم {fmtDayMonth(new Date(a.submittedAt))}</p>
                    <ApplicationActions id={a.id} status={a.status} />
                  </Card>
                ))}
                {!items.length && <p className="px-1 py-4 text-center text-xs text-muted">لا طلبات</p>}
              </section>
            );
          })}
        </div>
      </div>

      <section className="space-y-3">
        <SectionTitle>المستندات المطلوبة</SectionTitle>
        <Card className="divide-y divide-line">
          {TEACHER_DOCUMENTS.map((d) => (
            <div key={d.key} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1 font-semibold text-ink">{d.label}</span>
              {d.note && <span className="hidden text-xs text-muted md:inline">{d.note}</span>}
              <Badge tone={d.required ? 'brand' : 'neutral'}>{d.required ? 'إلزامي' : 'اختياري'}</Badge>
            </div>
          ))}
        </Card>
      </section>
    </>
  );
}
