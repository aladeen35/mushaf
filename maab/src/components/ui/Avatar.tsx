import { UserRound } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * صورة المستخدم: أيقونة محيطية في دائرة. لا صور للطالبات في الحصص أو
 * الواجهات العامة (البيئة النسائية، القسم 1)، فالأيقونة هي الافتراض.
 */
export function Avatar({
  size = 40,
  className,
  ring,
  label,
}: {
  size?: number;
  className?: string;
  ring?: boolean;
  label?: string;
}) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'grid shrink-0 place-items-center rounded-full border border-line bg-card text-brand',
        ring && 'border-2 border-gold',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <UserRound style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.6} />
    </span>
  );
}
