'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, errorText, IS_LIVE } from '@/lib/api';
import type { CountryCode } from '@/lib/domain/market';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type GoogleId = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.4 9.1 5.4 12 5.4z" />
    </svg>
  );
}

/**
 * الدخول بحساب Google: في النسخة الحية بزر Google الرسمي ورمزه يُتحقق منه في
 * الخادم، ويختفي إن لم يُضبط معرّف التطبيق. في نسخة العرض ينتقل لإكمال الحساب.
 */
export function GoogleButton({ country }: { country: CountryCode }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const countryRef = useRef(country);
  useEffect(() => {
    countryRef.current = country;
  }, [country]);

  useEffect(() => {
    if (!IS_LIVE || !CLIENT_ID || !box.current) return;
    const el = box.current;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      const g = (window as unknown as { google?: GoogleId }).google;
      if (!g) return;
      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            const r = await api<{ next: string }>('/auth/google', { body: { credential, country: countryRef.current } });
            router.push(r.next);
          } catch (e) {
            setError(errorText(e));
          }
        },
      });
      g.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: el.clientWidth, text: 'continue_with', locale: 'ar' });
    };
    document.head.appendChild(script);
    return () => script.remove();
  }, [router]);

  if (IS_LIVE && !CLIENT_ID) return null;
  if (IS_LIVE) {
    return (
      <div>
        <div ref={box} className="flex min-h-12 justify-center" />
        {error && <p className="mt-2 text-center text-xs text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <Link
      href="/onboarding"
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-ctl border border-line bg-card text-[15px] font-bold text-ink shadow-card hover:bg-field"
    >
      <GoogleMark />
      المتابعة بحساب Google
    </Link>
  );
}
