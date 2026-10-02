import Image from 'next/image';
import { asset } from '@/lib/base';
import { cn } from '@/lib/cn';

/** الشعار الكامل (المربع الأخضر): البداية وتسجيل الدخول — لا يقل عن 120 بكسل */
export function LogoFull({ size = 168, className, priority }: { size?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src={asset('/brand/logo-full.png')}
      alt="مآب لتحفيظ القرآن"
      width={size}
      height={size}
      priority={priority}
      className={cn('drop-shadow-[0_18px_30px_rgb(3_41_31/0.28)]', className)}
    />
  );
}

/** القوس الصغير بإطاره الذهبي والهلال — الرمز داخل الشعار الأفقي */
export function ArchMark({ size = 28, tone = 'page', className }: { size?: number; tone?: 'page' | 'hero'; className?: string }) {
  return (
    <svg viewBox="0 0 40 48" width={size} height={size * 1.2} className={className} aria-hidden>
      <path
        d="M4 46V25c0-5 2.4-8 6-10 4.4-2.4 8.3-5.6 10-11 1.7 5.4 5.6 8.6 10 11 3.6 2 6 5 6 10v21z"
        fill={tone === 'hero' ? 'rgb(255 253 248 / 0.1)' : 'var(--surface-card)'}
        stroke="var(--brand-gold)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M23.6 21.4a4.6 4.6 0 1 1-4.2-6.9 3.7 3.7 0 1 0 4.2 6.9z" fill="var(--brand-gold)" />
      <path d="M14.5 33.5c.6-3.3 2.8-5.4 5.5-6.4 2.7 1 4.9 3.1 5.5 6.4z" fill="var(--brand-gold)" opacity=".85" />
    </svg>
  );
}

/**
 * الشعار الأفقي للشريط العلوي: القوس الصغير، و«مآب» يمينه، و«لتحفيظ القرآن» تحته.
 * tone="hero" على الخلفية الخضراء، وtone="page" على الكريمي.
 */
export function LogoHorizontal({ tone = 'page', className }: { tone?: 'page' | 'hero'; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)} role="img" aria-label="مآب لتحفيظ القرآن">
      <span className="flex flex-col leading-none" aria-hidden>
        <span className={cn('font-display text-[25px] font-bold', tone === 'hero' ? 'text-on-hero' : 'text-brand')}>مآب</span>
        <span className={cn('mt-1 text-[9.5px] font-semibold', tone === 'hero' ? 'text-gold' : 'text-gold-text')}>لتحفيظ القرآن</span>
      </span>
      <ArchMark tone={tone} size={24} />
    </span>
  );
}

/**
 * إطار المحراب بحدّه الذهبي: رأس ملف الطالب وإطار البطل في الرئيسية.
 * قاعدته مستوية والمحتوى يوضع في أسفله.
 */
export function MihrabFrame({
  width = 92,
  className,
  children,
}: {
  width?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const height = Math.round(width * 1.22);
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-end justify-items-center', className)} style={{ width, height }}>
      <svg viewBox="0 0 100 122" width={width} height={height} className="absolute inset-0" aria-hidden>
        <path
          d="M5 120V60c0-12 6-19 15-24 11-6 21-13 27-25l3-7 3 7c6 12 16 19 27 25 9 5 15 12 15 24v60z"
          fill="var(--surface-card)"
          stroke="var(--brand-gold)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M12 120V62c0-9 5-15 12-19 10-6 19-12 24-22l2-4 2 4c5 10 14 16 24 22 7 4 12 10 12 19v58"
          fill="none"
          stroke="var(--brand-gold)"
          strokeOpacity=".35"
          strokeWidth="1"
        />
      </svg>
      <span className="relative mb-[14%] grid place-items-center">{children}</span>
    </span>
  );
}
