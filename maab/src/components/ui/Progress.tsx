import { cn } from '@/lib/cn';

/** شريط تقدّم يمتلئ من بداية السطر (اليمين في العربية) */
export function ProgressBar({
  value,
  label,
  className,
  tone = 'brand',
}: {
  value: number;
  label: string;
  className?: string;
  tone?: 'brand' | 'gold' | 'hero';
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full', tone === 'hero' ? 'bg-white/15' : 'bg-track', className)}
    >
      <div
        className={cn(
          'h-full rounded-full',
          tone === 'brand' && 'bg-gradient-to-l from-brand to-brand-soft',
          tone === 'gold' && 'bg-gradient-to-l from-gold-text to-gold',
          tone === 'hero' && 'bg-gradient-to-l from-gold to-[#efd9a8]',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** حلقة نسبة ذهبية كمؤشر «كمية المراجعة للعام» */
export function Ring({
  value,
  size = 112,
  stroke = 12,
  label,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn('relative grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${Math.round(pct)}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand-gold)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="tabular absolute text-2xl font-bold text-ink" aria-hidden>
        %{Math.round(pct)}
      </span>
    </div>
  );
}

/** أعمدة رأسية: مسار رمادي وعمود متدرّج، والقيمة فوق كل عمود */
export function BarChart({
  data,
  unit,
  legend,
  height = 176,
}: {
  data: { label: string; value: number }[];
  unit: string;
  legend: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <figure>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 flex-col items-center gap-1.5">
            <span className="tabular text-[11px] font-semibold text-muted">{d.value}</span>
            <div className="relative w-full max-w-7 flex-1 overflow-hidden rounded-t-md rounded-b-sm bg-track">
              <div
                className="absolute inset-x-0 bottom-0 rounded-t-md bg-gradient-to-t from-brand-deep via-brand to-brand-soft dark:from-brand-soft dark:to-brand"
                style={{ height: `${(d.value / max) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-ink">{d.label}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex items-center justify-center gap-2 text-xs text-muted">
        <span aria-hidden className="size-3 rounded-[3px] bg-brand" />
        {legend} ({unit})
      </figcaption>
      <table className="sr-only">
        <caption>{legend}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td>
                {d.value} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
