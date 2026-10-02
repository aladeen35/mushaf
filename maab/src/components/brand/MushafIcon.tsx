import type { SVGProps } from 'react';

/**
 * أيقونة تبويب المصحف: الرحل والمصحف المفتوح كما في أسفل الشعار.
 * بخطوط محيطية بسماكة أيقونات Lucide نفسها لتنسجم معها.
 */
export function MushafIcon({ strokeWidth = 2, ...props }: SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M12 7.5c-2-1.6-4.6-2.2-8-2v8.2c3.4-.2 6 .4 8 2 2-1.6 4.6-2.2 8-2V5.5c-3.4-.2-6 .4-8 2z" />
      <path d="M12 7.5v8.2" />
      <path d="m5 20 7-4.3 7 4.3" />
    </svg>
  );
}
