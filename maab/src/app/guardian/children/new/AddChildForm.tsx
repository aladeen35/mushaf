'use client';

import { Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PillRadio } from '@/components/ui/Choice';
import { SelectField, TextField } from '@/components/ui/Field';
import { ageFrom, arCount, YEARS } from '@/lib/format';

/** القيمة المؤقتة في المواصفات: يُقبل الذكور حتى 10 سنوات (سؤال مفتوح، القسم 1) */
export const MAX_BOY_AGE = 10;

const LEVELS = ['لم يبدأ الحفظ', 'يحفظ قصار السور', 'في جزء عمّ', 'أتمّ جزء عمّ', 'من 2 إلى 5 أجزاء', 'أكثر من 5 أجزاء'];
const GOALS = ['تأسيس وقراءة صحيحة', 'حفظ جزء عمّ', 'حفظ جزأين أو ثلاثة', 'حفظ القرآن كاملًا', 'مراجعة وتثبيت المحفوظ'];

export function AddChildForm({ today }: { today: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const age = birth ? ageFrom(birth, new Date(today)) : undefined;
  const boyTooOld = gender === 'male' && age !== undefined && age > MAX_BOY_AGE;

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const next: Record<string, string> = {};
        if (!name.trim()) next.name = 'اكتبي اسم الطالب';
        if (!birth) next.birth = 'تاريخ الميلاد مطلوب لاختيار المعلمة المناسبة';
        else if (age! < 4) next.birth = 'أقل عمر للتسجيل 4 سنوات';
        setErrors(next);
        if (Object.keys(next).length || boyTooOld) return;
        router.push('/guardian/plans');
      }}
    >
      <TextField id="child-name" label="اسم الطالب" placeholder="الاسم الأول" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
      <TextField
        id="birth"
        label="تاريخ الميلاد"
        type="date"
        max={today}
        value={birth}
        error={errors.birth}
        onChange={(e) => setBirth(e.target.value)}
        hint={age !== undefined && !errors.birth ? `العمر: ${arCount(age, YEARS)}` : undefined}
      />
      <PillRadio
        name="gender"
        legend="الجنس"
        value={gender}
        onChange={setGender}
        options={[
          { value: 'female', label: 'أنثى' },
          { value: 'male', label: 'ذكر' },
        ]}
      />
      {boyTooOld && (
        <p className="flex items-start gap-2 rounded-ctl border border-warning/30 bg-warning/8 p-3 text-sm leading-6 text-ink">
          <Info className="mt-1 size-4 shrink-0 text-warning" aria-hidden />
          الأكاديمية بمعلمات فقط، وتقبل الأولاد حتى {MAX_BOY_AGE} سنوات.
        </p>
      )}
      <SelectField id="level" label="المستوى الحالي في الحفظ" defaultValue={LEVELS[2]}>
        {LEVELS.map((l) => (
          <option key={l}>{l}</option>
        ))}
      </SelectField>
      <SelectField id="goal" label="الهدف" defaultValue={GOALS[1]}>
        {GOALS.map((g) => (
          <option key={g}>{g}</option>
        ))}
      </SelectField>
      <Button type="submit" block disabled={boyTooOld}>
        حفظ ومتابعة لاختيار الباقة
      </Button>
    </form>
  );
}
