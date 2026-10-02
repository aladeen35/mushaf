'use client';

import { KeyRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { api, errorText, IS_LIVE } from '@/lib/api';

export function StudentCodeForm() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const code = value.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(code)) return setError('الرمز ستة أحرف أو أرقام يولّدها ولي الأمر');
        if (!IS_LIVE) return router.push('/student');
        setBusy(true);
        try {
          const r = await api<{ next: string }>('/auth/student-code', { body: { code } });
          router.push(r.next);
        } catch (err) {
          setError(errorText(err));
          setBusy(false);
        }
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
        hint="يجده ولي الأمر في «أبنائي» ← رمز دخول الطالب"
      />
      <Button type="submit" block disabled={busy}>
        <KeyRound className="size-5" aria-hidden />
        دخول
      </Button>
    </form>
  );
}
