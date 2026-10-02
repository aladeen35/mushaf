import { cn } from '@/lib/cn';

/** شريط زخرفة نوبية رفيع، يأخذ لونه من النص (text-gold افتراضياً) */
export function NubianBand({ className }: { className?: string }) {
  return <div aria-hidden className={cn('nubian-band text-gold opacity-80', className)} />;
}
