import { CalendarDays, FileBadge, LogOut, ShieldCheck, Star, UserRound, UsersRound } from 'lucide-react';
import type { Metadata } from 'next';
import { MihrabFrame } from '@/components/brand/Brand';
import { ThemeToggle } from '@/components/features/ThemeToggle';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card, LeaderRow } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { ListRow } from '@/components/ui/ListRow';
import { ProgressBar } from '@/components/ui/Progress';
import { UNEXCUSED_ABSENCE_LIMIT } from '@/lib/domain/teachers';
import { teachers } from '@/lib/demo/data';

export const metadata: Metadata = { title: 'حسابي' };

export default function TeacherAccount() {
  const me = teachers[0];
  // الانضباط الشهري: الحضور في الموعد، والغياب، والتقارير في 12 ساعة، وتقييم أولياء الأمور (القسم 5)
  const discipline = { onTime: 97, absences: 0, reportsOnTime: 92 };
  return (
    <>
      <WaveHeader back="/teacher" className="pb-20">
        <div className="flex items-center gap-4 pb-2">
          <MihrabFrame width={84}>
            <UserRound className="size-9 text-brand" strokeWidth={1.5} aria-hidden />
          </MihrabFrame>
          <div className="min-w-0">
            <p className="text-2xl font-bold">{me.name}</p>
            <p className="mt-0.5 text-sm text-on-hero/80">معلمة · {me.riwayah}</p>
            <p className="tabular mt-1 flex items-center gap-1 text-sm text-gold">
              <Star className="size-4 fill-gold" aria-hidden />
              {me.rating} · {me.studentsCount} طالبًا
            </p>
          </div>
        </div>
      </WaveHeader>

      <Page className="-mt-10 space-y-3">
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-ink">انضباطك هذا الشهر</p>
            <Badge tone="success">نشطة</Badge>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted">الحضور في الموعد</span>
              <span className="tabular font-bold text-ink">%{discipline.onTime}</span>
            </div>
            <ProgressBar value={discipline.onTime} label="الحضور في الموعد" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted">تقارير خلال 12 ساعة</span>
              <span className="tabular font-bold text-ink">%{discipline.reportsOnTime}</span>
            </div>
            <ProgressBar value={discipline.reportsOnTime} label="التقارير في المهلة" tone="gold" />
          </div>
          <LeaderRow label="غياب دون عذر" value={`${discipline.absences} من ${UNEXCUSED_ABSENCE_LIMIT}`} />
          <p className="text-[11px] leading-5 text-muted">ثلاث غيابات دون عذر في شهر تحوّل الحالة إلى «موقوفة» حتى تراجعها المشرفة.</p>
        </Card>

        <ListRow href="/teacher/students" icon={<UsersRound className="size-5" />} label="طلابي" meta={me.studentsCount} />
        <ListRow href="/teacher/availability" icon={<CalendarDays className="size-5" />} label="أوقات الإتاحة" />
        <ListRow href="/join" icon={<FileBadge className="size-5" />} label="المستندات والإجازة" sub="الهوية والإجازة لا يراها إلا المشرفة والمدير العام" />
        <Card className="space-y-3 p-4">
          <p className="text-sm font-bold text-ink">المظهر</p>
          <ThemeToggle />
        </Card>
        <ListRow href="/legal/privacy" icon={<ShieldCheck className="size-5" />} label="الخصوصية وسياسة عدم التسجيل" />
        <ListRow href="/" icon={<LogOut className="size-5" />} label="تسجيل الخروج" tone="danger" />
      </Page>
    </>
  );
}
