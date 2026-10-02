'use client';

import { KeyRound, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PhoneField, TextField } from '@/components/ui/Field';
import { parsePhone } from '@/lib/phone';

export function LoginForm({ asStudent }: { asStudent: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();

  if (asStudent) {
    return (
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^[A-Z0-9]{6}$/i.test(value.trim())) return setError('الرمز ستة أحرف أو أرقام يولّدها ولي الأمر');
          router.push('/guardian');
        }}
      >
        <TextField
          id="code"
          label="رمز الطالب"
          dir="ltr"
          autoComplete="one-time-code"
          placeholder="مثل: R7K2QM"
          className="[&_input]:text-center [&_input]:tracking-[0.4em] [&_input]:uppercase"
          value={value}
          error={error}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
          hint="يجده ولي الأمر في ملف الطالب ← «رمز الدخول»"
        />
        <Button type="submit" block>
          <KeyRound className="size-5" aria-hidden />
          دخول
        </Button>
      </form>
    );
  }

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const phone = parsePhone(value, 'SA')?.e164.replace('+966', '');
        if (!phone) return setError('الرقم غير صحيح، أدخلي جوالًا سعوديًا يبدأ بـ5');
        router.push(`/login/verify?phone=${phone}`);
      }}
    >
      <PhoneField
        id="phone"
        label="رقم الجوال"
        placeholder="5X XXX XXXX"
        value={value}
        error={error}
        onChange={(e) => {
          setValue(e.target.value);
          setError(undefined);
        }}
        hint="نرسل رمز التحقق برسالة نصية، صالحًا لخمس دقائق."
      />
      <Button type="submit" block>
        <Smartphone className="size-5" aria-hidden />
        أرسل رمز التحقق
      </Button>
    </form>
  );
}
