'use client';

import { Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PillRadio } from '@/components/ui/Choice';
import { SelectField, TextField } from '@/components/ui/Field';
import { api, errorText, IS_LIVE } from '@/lib/api';
import { MAX_BOY_AGE, MIN_AGE } from '@/lib/domain/students';
import { ageFrom, arCount, YEARS } from '@/lib/format';

const LEVELS = ['لم يبدأ الحفظ', 'يحفظ قصار السور', 'في جزء عمّ', 'أتمّ جزء عمّ', 'من 2 إلى 5 أجزاء', 'أكثر من 5 أجزاء'];
const GOALS = ['تأسيس وقراءة صحيحة', 'حفظ جزء عمّ', 'حفظ جزأين أو ثلاثة', 'حفظ القرآن كاملًا', 'مراجعة وتثبيت المحفوظ'];

export function AddChildForm({ today }: { today: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const [level, setLevel] = useState(LEVELS[2]);
  const [goal, setGoal] = useState(GOALS[1]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const age = birth ? ageFrom(birth, new Date(today)) : undefined;
  const boyTooOld = gender === 'male' && age !== undefined && age > MAX_BOY_AGE;

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const next: Record<string, string> = {};
        if (name.trim().split(/\s+/).length < 2) next.name = 'اكتبي الاسم الأول واسم الأب على الأقل';
        if (!birth) next.birth = 'تاريخ الميلاد مطلوب لاختيار المعلمة المناسبة';
        else if (age! < MIN_AGE) next.birth = `أقل عمر للتسجيل ${arCount(MIN_AGE, YEARS)}`;
        setErrors(next);
        if (Object.keys(next).length || boyTooOld) return;
        if (!IS_LIVE) return router.push('/guardian/plans');
        setBusy(true);
        try {
          const child = await api<{ id: string }>('/students', { body: { fullName: name.trim(), gender, birthDate: birth, level, goal } });
          router.push(`/guardian/plans?child=${child.id}`);
          router.refresh();
        } catch (err) {
          setErrors({ form: errorText(err) });
          setBusy(false);
        }
      }}
    >
      <TextField id="child-name" label="اسم الطالب" placeholder="الاسم الأول واسم الأب" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
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
          الأكاديمية بمعلمات فقط، وتقبل الأولاد حتى {arCount(MAX_BOY_AGE, YEARS)}.
        </p>
      )}
      <SelectField id="level" label="المستوى الحالي في الحفظ" value={level} onChange={(e) => setLevel(e.target.value)}>
        {LEVELS.map((l) => (
          <option key={l}>{l}</option>
        ))}
      </SelectField>
      <SelectField id="goal" label="الهدف" value={goal} onChange={(e) => setGoal(e.target.value)}>
        {GOALS.map((g) => (
          <option key={g}>{g}</option>
        ))}
      </SelectField>
      {errors.form && <p className="rounded-ctl bg-danger/8 px-3 py-2 text-sm text-danger">{errors.form}</p>}
      <Button type="submit" block disabled={boyTooOld || busy}>
        حفظ ومتابعة لاختيار الباقة
      </Button>
    </form>
  );
}
