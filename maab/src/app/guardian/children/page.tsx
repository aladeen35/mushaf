import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { ButtonLink } from '@/components/ui/Button';
import { plan } from '@/lib/domain/billing';
import { childrenOf, getTeacher, now, upcoming } from '@/lib/demo/queries';
import { ageFrom, arCount, fmtRelativeDay, fmtTime, SESSIONS, YEARS } from '@/lib/format';
import { ChildrenPicker, type ChildItem } from './ChildrenPicker';

export const metadata: Metadata = { title: 'أبنائي' };

// رموز دخول الطلاب القاصرين — يولّدها ولي الأمر ويغيّرها متى شاء
const CODES: Record<string, string> = { s1: 'R7K2QM', s2: 'A4N9TX' };

export default function Children() {
  const at = now();
  const kids = childrenOf();
  const items: ChildItem[] = kids.map((k) => {
    const next = upcoming([k.id], at)[0];
    const age = ageFrom(k.birthDate, at);
    return {
      id: k.id,
      name: k.fullName,
      meta: `${k.gender === 'female' ? 'طالبة' : 'طالب'} · ${arCount(age, YEARS)} · ${k.level}`,
      teacher: getTeacher(k.teacherId).name,
      plan: `${plan(k.subscription.plan).name} · ${k.subscription.duration} دقيقة`,
      balance: `${arCount(k.subscription.remaining, SESSIONS)} من ${k.subscription.total}`,
      next: next ? `${fmtRelativeDay(new Date(next.startsAt), at)} ${fmtTime(new Date(next.startsAt))}` : '—',
      code: CODES[k.id],
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
