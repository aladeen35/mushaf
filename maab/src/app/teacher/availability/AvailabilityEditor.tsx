'use client';

import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DayPills } from '@/components/ui/Choice';
import { cn } from '@/lib/cn';

type Window = { from: string; to: string };
type Day = { key: string; day: string; windows: Window[] };

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** فترات الإتاحة الأسبوعية والاستثناءات — النظام يولّد منها المواعيد ويمنع التعارض */
export function AvailabilityEditor({ initial }: { initial: Day[] }) {
  const [days, setDays] = useState(initial);
  const [saved, setSaved] = useState(false);
  const active = days.filter((d) => d.windows.length).map((d) => d.key);

  const setWindows = (key: string, windows: Window[]) => {
    setSaved(false);
    setDays((all) => all.map((d) => (d.key === key ? { ...d, windows } : d)));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <DayPills
          legend="أيام الإتاحة"
          value={active}
          onChange={(keys) => {
            setSaved(false);
            setDays((all) =>
              all.map((d) =>
                keys.includes(d.key) ? (d.windows.length ? d : { ...d, windows: [{ from: '16:00', to: '20:00' }] }) : { ...d, windows: [] },
              ),
            );
          }}
          options={days.map((d) => ({ value: d.key, label: d.day }))}
        />
      </Card>

      {days
        .filter((d) => d.windows.length)
        .map((d) => (
          <Card key={d.key} className="space-y-2.5 p-4">
            <p className="font-bold text-ink">{d.day}</p>
            {d.windows.map((w, i) => {
              const bad = toMin(w.to) - toMin(w.from) < 30;
              return (
                <div key={i} className="flex items-center gap-2">
                  {(['from', 'to'] as const).map((k) => (
                    <label key={k} className="flex flex-1 items-center gap-2 rounded-ctl bg-field px-3">
                      <span className="text-xs text-muted">{k === 'from' ? 'من' : 'إلى'}</span>
                      <input
                        type="time"
                        step={900}
                        value={w[k]}
                        onChange={(e) => setWindows(d.key, d.windows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                        className={cn('tabular h-10 w-full bg-transparent text-sm font-bold text-ink outline-none', bad && 'text-danger')}
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    aria-label="حذف الفترة"
                    onClick={() => setWindows(d.key, d.windows.filter((_, j) => j !== i))}
                    className="grid size-10 place-items-center rounded-ctl text-muted hover:bg-danger/8 hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })}
            {d.windows.some((w) => toMin(w.to) - toMin(w.from) < 30) && (
              <p className="text-xs font-semibold text-danger">الفترة يجب ألا تقل عن 30 دقيقة.</p>
            )}
            <button
              type="button"
              onClick={() => setWindows(d.key, [...d.windows, { from: '20:00', to: '21:00' }])}
              className="flex items-center gap-1 text-xs font-bold text-brand"
            >
              <Plus className="size-3.5" aria-hidden />
              فترة أخرى
            </button>
          </Card>
        ))}

      <Card className="space-y-3 p-4">
        <p className="flex items-center gap-2 font-bold text-ink">
          <CalendarOff className="size-5 text-gold-text" aria-hidden />
          الاستثناءات
        </p>
        <div className="flex items-center justify-between rounded-ctl bg-field px-3 py-2.5 text-sm">
          <span className="font-semibold text-ink">إجازة</span>
          <span className="tabular text-muted">15 – 17 أكتوبر</span>
        </div>
        <p className="text-xs leading-5 text-muted">تُستثنى أيام الإجازة والمرض من المواعيد المتاحة للحجز.</p>
      </Card>

      <Button block onClick={() => setSaved(true)} disabled={days.some((d) => d.windows.some((w) => toMin(w.to) - toMin(w.from) < 30))}>
        {saved ? 'حُفظت الأوقات' : 'حفظ الأوقات'}
      </Button>
      <p className="text-center text-xs leading-5 text-muted">
        تحدّدين أوقاتك المتاحة فقط، والإدارة تحدّد سعر الحصة. يُترك بين كل حصتين 5 دقائق تلقائيًا.
      </p>
    </div>
  );
}
