'use client';

import { Check, Pencil, UserRound, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PhoneField, SelectField, TextField } from '@/components/ui/Field';
import { CITIES } from '@/lib/cities';
import { cn } from '@/lib/cn';

type Kind = 'guardian' | 'self';

function Check2({ checked, onChange, children, id }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; id: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-ink">
      <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] transition peer-focus-visible:outline-2 peer-focus-visible:outline-gold',
          checked ? 'border-brand bg-brand text-on-brand' : 'border-brand/40 bg-card',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3.5} />}
      </span>
      <span>{children}</span>
    </label>
  );
}

export function OnboardingForm() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>('guardian');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [terms, setTerms] = useState(false);
  const [childConsent, setChildConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const next: Record<string, string> = {};
        if (name.trim().split(/\s+/).length < 2) next.name = 'اكتبي الاسم الأول واسم العائلة';
        if (email && !/^\S+@\S+\.\S+$/.test(email)) next.email = 'صيغة البريد غير صحيحة';
        if (!terms) next.terms = 'الموافقة على الشروط وسياسة الخصوصية مطلوبة';
        if (kind === 'guardian' && !childConsent) next.child = 'موافقة ولي الأمر مطلوبة لتسجيل القاصرين';
        setErrors(next);
        if (Object.keys(next).length) return;
        router.push(kind === 'guardian' ? '/guardian/children/new' : '/guardian/plans');
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">أسجّل</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { v: 'guardian', label: 'لأبنائي', sub: 'ولي أمر', icon: UsersRound },
              { v: 'self', label: 'لنفسي', sub: 'طالبة بالغة', icon: UserRound },
            ] as const
          ).map(({ v, label, sub, icon: Icon }) => (
            <label
              key={v}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-ctl border-[1.5px] p-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold',
                kind === v ? 'border-brand bg-brand/6' : 'border-line bg-card',
              )}
            >
              <input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} className="sr-only" />
              <span className={cn('grid size-9 place-items-center rounded-full', kind === v ? 'bg-brand text-on-brand' : 'bg-field text-muted')}>
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-bold text-ink">{label}</span>
                <span className="block text-xs text-muted">{sub}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <TextField
        id="name"
        label="الاسم الكامل"
        autoComplete="name"
        placeholder="الاسم الأول واسم العائلة"
        value={name}
        error={errors.name}
        onChange={(e) => setName(e.target.value)}
      />
      <SelectField id="city" label="المدينة" defaultValue="الرياض">
        {CITIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </SelectField>
      <TextField
        id="email"
        label="البريد الإلكتروني (اختياري)"
        type="email"
        dir="ltr"
        autoComplete="email"
        placeholder="name@example.com"
        value={email}
        error={errors.email}
        onChange={(e) => setEmail(e.target.value)}
        adornment={<Pencil className="size-4" aria-hidden />}
        hint="لإرسال الإيصالات والتقارير الشهرية."
      />
      <PhoneField id="phone" label="رقم الجوال" value="51 234 5678" readOnly hint="تم التحقق منه برمز OTP." />

      <div className="space-y-3 rounded-ctl bg-field p-3.5">
        <Check2 id="terms" checked={terms} onChange={setTerms}>
          أوافق على الشروط والأحكام وسياسة الخصوصية وسياسة عدم تسجيل الحصص.
        </Check2>
        {errors.terms && <p className="text-xs font-semibold text-danger">{errors.terms}</p>}
        {kind === 'guardian' && (
          <>
            <Check2 id="child" checked={childConsent} onChange={setChildConsent}>
              بصفتي ولي الأمر، أوافق على معالجة بيانات أبنائي لأغراض التعليم فقط.
            </Check2>
            {errors.child && <p className="text-xs font-semibold text-danger">{errors.child}</p>}
          </>
        )}
      </div>

      <Button type="submit" block>
        {kind === 'guardian' ? 'متابعة وإضافة الأبناء' : 'متابعة واختيار الباقة'}
      </Button>
    </form>
  );
}
