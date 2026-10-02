import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { ButtonLink } from '@/components/ui/Button';
import { dataset } from '@/lib/data';
import { plan } from '@/lib/domain/billing';
import { ADULT_AGE } from '@/lib/domain/students';
import { ageFrom, arCount, fmtRelativeDay, fmtTime, SESSIONS, YEARS } from '@/lib/format';
import { ChildrenPicker, type ChildItem } from './ChildrenPicker';

export const metadata: Metadata = { title: 'أبنائي' };

// رموز دخول الطلاب القاصرين في نسخة العرض — في النسخة الحية يصدرها ولي الأمر
// من هنا، ولا يُخزَّن إلا بصمتها فتظهر مرة واحدة عند الإصدار
const DEMO_CODES: Record<string, string> = { s1: 'R7K2QM', s2: 'A4N9TX' };

export default async function Children() {
  const d = await dataset('guardian');
  const at = d.now();
  const kids = d.childrenOf();
  const items: ChildItem[] = kids.map((k) => {
    const next = d.upcoming([k.id], at)[0];
    const age = ageFrom(k.birthDate, at);
    const sub = k.subscription;
    return {
      id: k.id,
      name: k.fullName,
      meta: `${k.gender === 'female' ? 'طالبة' : 'طالب'} · ${arCount(age, YEARS)} · ${k.level}`,
      teacher: d.getTeacher(k.teacherId).name,
      plan: sub ? `${plan(sub.plan).name} · ${sub.duration} دقيقة` : 'لا باقة بعد',
      balance: sub ? `${arCount(sub.remaining, SESSIONS)} من ${sub.total}` : '—',
      next: next ? `${fmtRelativeDay(new Date(next.startsAt), at)} ${fmtTime(new Date(next.startsAt))}` : '—',
      // الطالبة البالغة تدخل برقمها، فلا رمز لها
      code: age >= ADULT_AGE ? null : d.mode === 'demo' ? (DEMO_CODES[k.id] ?? null) : '',
    };
  });

  return (
    <>
      <WaveHeader title="أبنائي" back="/guardian/account" />
      <Page className="-mt-4">
        <p className="text-sm leading-7 text-muted">
          هذه ملفات أبنائك المسجّلين في مآب. اختاري أحدهم لعرض ملفه، أو افتحي التفاصيل لمعرفة معلمته وباقته ورمز دخوله.
        </p>
        <p className="flex items-center justify-between font-bold text-ink">
          الأبناء <span className="tabular text-muted">({items.length})</span>
        </p>
        <ChildrenPicker items={items} />
        <ButtonLink href="/guardian/children/new" variant="secondary" block>
          <Plus className="size-5" aria-hidden />
          إضافة ابن أو ابنة
        </ButtonLink>
      </Page>
    </>
  );
}
