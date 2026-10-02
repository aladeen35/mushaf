'use client';

import { FileCheck, Upload } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { cn } from '@/lib/cn';

// الأنواع المسموحة وحدّ الحجم للإيصالات (القسم 15) — ويُفحص المحتوى في الخادم لا الامتداد فقط
const ACCEPT = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_MB = 5;

export function ReceiptUpload({ today }: { today: string }) {
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState<string>();
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex items-center gap-3 rounded-ctl bg-success/10 p-4 text-sm text-ink">
        <FileCheck className="size-6 shrink-0 text-success" aria-hidden />
        استلمنا الإيصال، والطلب الآن بانتظار مراجعة المالية. سيصلك إشعار عند الاعتماد.
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return setFileError('أرفقي صورة الإيصال أو ملف PDF');
        setSent(true);
      }}
    >
      <label
        htmlFor="receipt"
        className={cn(
          'flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed px-4 py-6 text-center transition hover:bg-field',
          fileError ? 'border-danger/60' : file ? 'border-success/50 bg-success/5' : 'border-gold/60',
        )}
      >
        {file ? <FileCheck className="size-8 text-success" aria-hidden /> : <Upload className="size-8 text-gold-text" aria-hidden />}
        <span className="text-sm font-bold text-ink">{file ? file.name : 'ارفعي إيصال التحويل'}</span>
        <span className="text-xs text-muted">صورة أو PDF، حتى {MAX_MB} ميجابايت</span>
        <input
          id="receipt"
          type="file"
          accept={ACCEPT.join(',')}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (!ACCEPT.includes(f.type)) return setFileError('النوع غير مسموح: PDF أو JPG أو PNG فقط');
            if (f.size > MAX_MB * 1024 * 1024) return setFileError(`الملف أكبر من ${MAX_MB} ميجابايت`);
            setFileError(undefined);
            setFile(f);
          }}
        />
      </label>
      {fileError && <p className="text-xs font-semibold text-danger">{fileError}</p>}
      <TextField id="sender" label="اسم المحوِّل" placeholder="كما يظهر في الإيصال" required />
      <TextField id="date" label="تاريخ التحويل" type="date" defaultValue={today} max={today} required />
      <Button type="submit" block>
        إرسال الإيصال
      </Button>
    </form>
  );
}
