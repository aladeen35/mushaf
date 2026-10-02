import type { Metadata } from 'next';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { dataset } from '@/lib/data';
import { DEMO_NEXT_REF } from '@/lib/demo/data';
import { paymentMethodsFor } from '@/lib/domain/market';
import { ADULT_AGE } from '@/lib/domain/students';
import { ageFrom, currentTz } from '@/lib/format';
import { BookingForm, type BookingChild, type TeacherOption } from './BookingForm';

export const metadata: Metadata = { title: 'اختيار الأوقات' };

// الفترات الفارغة لكل معلمة في نسخة العرض؛ النسخة الحية تحسبها من إتاحة المعلمة
// وحصصها المحجوزة والفاصل، بتوقيت ولي الأمر
const slot = (label: string) => ({ value: label, label });
const DEMO_FREE: Record<string, TeacherOption['free']> = {
  t1: { sun: ['4:00 م', '6:00 م', '8:00 م'].map(slot), mon: ['4:30 م', '6:30 م'].map(slot), tue: ['3:00 م', '6:00 م'].map(slot), thu: ['5:00 م', '7:00 م'].map(slot), sat: ['10:00 ص', '12:00 م'].map(slot) },
  t2: { sun: ['4:00 م'].map(slot), mon: ['5:00 م', '6:00 م'].map(slot), wed: ['4:00 م', '5:30 م'].map(slot), thu: ['4:30 م', '6:00 م'].map(slot) },
  t3: { sat: ['9:00 ص', '11:00 ص'].map(slot), mon: ['8:00 م', '9:00 م'].map(slot), wed: ['8:00 م'].map(slot) },
};

export default async function Checkout() {
  const d = await dataset('guardian');
  const at = d.now();
  const kids: BookingChild[] = d.childrenOf().map((k) => ({
    id: k.id,
    name: k.name,
    fullName: k.fullName,
    teacherId: k.teacherId,
    category: ageFrom(k.birthDate, at) >= ADULT_AGE ? 'women' : 'children',
  }));
  const teachers: TeacherOption[] = d.teachers.map((t) => ({
    id: t.id,
    name: t.name,
    headline: t.headline,
    rating: t.rating,
    categories: t.categories,
    ...(d.mode === 'demo' ? { free: DEMO_FREE[t.id] } : {}),
  }));
  const currency = d.guardian.currency;

  return (
    <>
      <WaveHeader title="الأوقات والمعلمة" back="/guardian/plans" />
      <Page className="-mt-4">
        <BookingForm
          kids={kids}
          teachers={teachers}
          prices={d.PRICES[currency]}
          currency={currency}
          method={paymentMethodsFor(currency)[0]}
          tz={currentTz()}
          demoRef={DEMO_NEXT_REF}
        />
      </Page>
    </>
  );
}
