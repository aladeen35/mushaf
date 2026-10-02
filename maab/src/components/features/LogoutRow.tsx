'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api, IS_LIVE } from '@/lib/api';

/** سطر «تسجيل الخروج» في الحساب: ينهي الجلسة في الخادم ثم يعود للبداية */
export function LogoutRow() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        if (IS_LIVE) await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        router.push('/');
        router.refresh();
      }}
      className="flex min-h-15 w-full items-center gap-3 rounded-card bg-card px-3.5 py-2.5 text-start shadow-card transition hover:bg-field"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-ctl bg-danger/10 text-danger" aria-hidden>
        <LogOut className="size-5" />
      </span>
      <span className="flex-1 font-semibold text-danger">تسجيل الخروج</span>
    </button>
  );
}
