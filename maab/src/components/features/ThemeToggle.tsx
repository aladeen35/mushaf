'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

type Mode = 'system' | 'light' | 'dark';

const KEY = 'maab-theme';

function read(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(m: Mode) {
  try {
    if (m === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, m);
  } catch {}
  const root = document.documentElement;
  if (m === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', m);
}

/** الوضع الداكن تلقائي حسب الجهاز، مع زر تبديل (القسم 16) */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('system');

  // يُقرأ الاختيار المحفوظ بعد التركيب فقط، فيطابق الرسم الأول ما رسمه الخادم
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(read());
  }, []);

  function choose(m: Mode) {
    setMode(m);
    apply(m);
  }

  const options = [
    { v: 'system', label: 'تلقائي', icon: Monitor },
    { v: 'light', label: 'فاتح', icon: Sun },
    { v: 'dark', label: 'داكن', icon: Moon },
  ] as const;

  return (
    <div role="radiogroup" aria-label="المظهر" className="grid grid-cols-3 gap-1 rounded-ctl bg-field p-1">
      {options.map(({ v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={mode === v}
          onClick={() => choose(v)}
          className={cn(
            'flex h-9 items-center justify-center gap-1.5 rounded-[10px] text-xs font-bold transition',
            mode === v ? 'bg-card text-brand shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
