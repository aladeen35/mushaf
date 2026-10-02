import { ChevronDown, Search } from 'lucide-react';
import type { Metadata } from 'next';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { LeaderRow } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/Progress';
import { dataset } from '@/lib/data';
import { fmtRelativeDay, fmtTime } from '@/lib/format';

export const metadata: Metadata = { title: 'طلابي' };

export default async function TeacherStudents() {
  const d = await dataset('teacher');
  const { teacherRoster } = d;
  const at = d.now();
  return (
    <>
      <WaveHeader title="طلابي" back="/teacher" />
      <Page className="-mt-4">
        <p className="text-sm leading-7 text-muted">
          الطلاب المسندون إليكِ فقط. لا تظهر لكِ أي بيانات مالية، ولا صور الطالبات في الحصص (الكاميرا اختيارية للطالبة).
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 start-4 my-auto size-5 text-muted" aria-hidden />
          <label htmlFor="q" className="sr-only">
            بحث
          </label>
          <input id="q" placeholder="ابحثي باسم الطالب" className="h-12 w-full rounded-card bg-card ps-12 pe-4 shadow-card outline-none focus:ring-1 focus:ring-gold" />
        </div>
        <p className="flex items-center justify-between font-bold text-ink">
          الطلاب <span className="tabular text-muted">({teacherRoster.length})</span>
        </p>
        {!teacherRoster.length && <p className="rounded-card bg-card p-4 text-sm text-muted shadow-card">لسه ما أُسند إليكِ طلاب.</p>}
        <div className="space-y-3">
          {teacherRoster.map((s, i) => (
            <details key={s.id} name="student" open={i === 0} className="group overflow-hidden rounded-card bg-card shadow-card open:ring-1 open:ring-brand/25">
              <summary className="flex h-16 cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
                <Avatar size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-ink">{s.name}</span>
                  <span className="block text-xs text-muted">{s.category}</span>
                </span>
                <Badge tone={s.mastery >= 90 ? 'success' : s.mastery >= 75 ? 'gold' : 'warning'}>%{s.mastery}</Badge>
                <ChevronDown className="size-5 text-muted transition group-open:rotate-180 group-open:text-brand" aria-hidden />
              </summary>
              <div className="space-y-2 px-4 pb-4">
                <div className="rounded-ctl border border-brand/40 bg-brand/5 px-3 py-2.5 text-sm">
                  <span className="text-muted">المقطع الحالي: </span>
                  <span className="font-bold text-ink">{s.current}</span>
                </div>
                <div className="rounded-ctl bg-field px-3 py-1">
                  <LeaderRow label="الحصة القادمة" value={s.nextAt ? `${fmtRelativeDay(new Date(s.nextAt), at)} ${fmtTime(new Date(s.nextAt))}` : '—'} />
                  <LeaderRow label="متوسط الإتقان" value={`%${s.mastery}`} />
                </div>
                <ProgressBar value={s.mastery} label={`إتقان ${s.name}`} />
                <ButtonLink href={`/teacher/mushaf/${s.page}`} size="sm" variant="secondary" block>
                  فتح المقطع في المصحف
                </ButtonLink>
              </div>
            </details>
          ))}
        </div>
      </Page>
    </>
  );
}
