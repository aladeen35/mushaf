import type { Metadata } from 'next';
import { pickChild } from '@/components/features/ChildTabs';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { DURATIONS, paymentReference, plan, PLANS, type Duration, type PlanId } from '@/lib/domain/billing';
import { guardian, payments, PRICES, teachers } from '@/lib/demo/data';
import { childrenOf, now } from '@/lib/demo/queries';
import { ageFrom } from '@/lib/format';
import { BookingForm, type TeacherOption } from './BookingForm';

export const metadata: Metadata = { title: 'اختيار الأوقات' };

// الفترات الفارغة لكل معلمة بعد استبعاد المحجوز والفاصل — تُحسب في قاعدة البيانات لاحقاً
const FREE: Record<string, TeacherOption['free']> = {
  t1: { sun: ['4:00 م', '6:00 م', '8:00 م'], mon: ['4:30 م', '6:30 م'], tue: ['3:00 م', '6:00 م'], thu: ['5:00 م', '7:00 م'], sat: ['10:00 ص', '12:00 م'] },
  t2: { sun: ['4:00 م'], mon: ['5:00 م', '6:00 م'], wed: ['4:00 م', '5:30 م'], thu: ['4:30 م', '6:00 م'] },
  t3: { sat: ['9:00 ص', '11:00 ص'], mon: ['8:00 م', '9:00 م'], wed: ['8:00 م'] },
};

export default async function Checkout({ searchParams }: PageProps<'/guardian/plans/checkout'>) {
  const sp = await searchParams;
  const child = pickChild(childrenOf(), sp.child);
  const planId = (PLANS.some((p) => p.id === sp.plan) ? sp.plan : 'regular') as PlanId;
  const duration = (DURATIONS.includes(Number(sp.duration) as Duration) ? Number(sp.duration) : 45) as Duration;
  const tier = plan(planId);
  // المعلمات المسموح لهن بفئة الطالب فقط (أطفال أو نساء) — القسم 5
  const category = ageFrom(child.birthDate, now()) >= 18 ? 'women' : 'children';
  const options = teachers
    .filter((t) => t.categories.includes(category))
    .map((t) => ({ id: t.id, name: t.name, headline: t.headline, rating: t.rating, free: FREE[t.id] }));
  // المعلمة الحالية أولاً حتى يبقى الطالب معها
  options.sort((a, b) => (a.id === child.teacherId ? -1 : b.id === child.teacherId ? 1 : 0));
  const lastSeq = Math.max(...payments.map((p) => Number(p.ref.slice(-6))), 152);

  return (
    <>
      <WaveHeader title="الأوقات والمعلمة" back={`/guardian/plans?child=${child.id}`}>
        <p className="pb-2 text-center text-sm text-on-hero/80">
          باقة {tier.name} لـ{child.name} · {duration} دقيقة
        </p>
      </WaveHeader>
      <Page className="-mt-4">
        <BookingForm
          childId={child.id}
          childName={child.fullName}
          planId={planId}
          planName={tier.name}
          perWeek={tier.perWeek}
          sessions={tier.sessions}
          duration={duration}
          price={PRICES[guardian.currency][planId][duration]}
          currency={guardian.currency}
          teachers={options}
          nextRef={paymentReference(2026, lastSeq + 1)}
        />
      </Page>
    </>
  );
}
