'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api, IS_LIVE } from '@/lib/api';

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="تسجيل الخروج"
      className={className ?? 'grid size-10 place-items-center rounded-full text-on-hero hover:bg-white/10'}
      onClick={async () => {
        if (IS_LIVE) await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        router.push('/');
        router.refresh();
      }}
    >
      <LogOut className="size-5" />
    </button>
  );
}
