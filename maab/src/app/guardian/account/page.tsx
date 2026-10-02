import {
  Bell,
  HandHeart,
  Headset,
  Receipt,
  ShieldCheck,
  Sprout,
  UserRound,
  UsersRound,
  Wallet,
} from 'lucide-react';
import type { Metadata } from 'next';
import { MihrabFrame } from '@/components/brand/Brand';
import { MushafIcon } from '@/components/brand/MushafIcon';
import { ThemeToggle } from '@/components/features/ThemeToggle';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { ListRow } from '@/components/ui/ListRow';
import { LogoutRow } from '@/components/features/LogoutRow';
import { dataset } from '@/lib/data';
import { displayPhone } from '@/lib/phone';

export const metadata: Metadata = { title: 'الحساب' };

export default async function Account() {
  const d = await dataset('guardian');
  const { guardian } = d;
  const kids = d.childrenOf();
  return (
    <>
      <WaveHeader back="/guardian" curve="swoosh" className="pb-20">
        <div className="flex items-center gap-4 pb-2">
          <MihrabFrame width={84}>
            <UserRound className="size-9 text-brand" strokeWidth={1.5} aria-hidden />
          </MihrabFrame>
          <div className="min-w-0">
            <p className="text-2xl font-bold">{guardian.name}</p>
            <p className="mt-0.5 text-sm text-on-hero/80">
              {guardian.role} · {guardian.city}
            </p>
            <p className="tabular mt-1 text-sm text-gold" dir="ltr">
              {guardian.phone ? displayPhone(guardian.phone) : guardian.email}
            </p>
          </div>
        </div>
      </WaveHeader>

      <Page className="-mt-10 space-y-3">
        <ListRow
          href="/guardian/children"
          icon={<UsersRound className="size-5" />}
          label="أبنائي"
          sub={kids.map((k) => k.name).join('، ')}
          meta={kids.length}
        />
        <ListRow href="/guardian/plans" icon={<Wallet className="size-5" />} label="الباقات والاشتراكات" />
        <ListRow href="/guardian/payments" icon={<Receipt className="size-5" />} label="المدفوعات والإيصالات" />
        <ListRow
          href="/guardian/notifications"
          icon={<Bell className="size-5" />}
          label="الإشعارات"
          meta={<Badge tone="gold">{d.unreadCount()} جديدة</Badge>}
        />
        <ListRow href="/guardian/progress" icon={<Sprout className="size-5" />} label="خطط الحفظ والتقارير" />
        <ListRow href="/guardian/mushaf" icon={<MushafIcon className="size-5" />} label="المصحف" />
        <ListRow href="/azkar" icon={<HandHeart className="size-5" />} label="الأذكار والورد" />

        <Card className="space-y-3 p-4">
          <p className="text-sm font-bold text-ink">المظهر</p>
          <ThemeToggle />
        </Card>

        <ListRow href="/legal/privacy" icon={<ShieldCheck className="size-5" />} label="الخصوصية والموافقات" sub="تنزيل بياناتي أو طلب حذف الحساب" />
        <ListRow href="/legal/cancellation" icon={<Headset className="size-5" />} label="سياسات الحصص والدعم" />
        <LogoutRow />
      </Page>
    </>
  );
}
