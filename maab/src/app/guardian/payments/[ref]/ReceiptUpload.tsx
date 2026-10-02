'use client';

import { FileCheck, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { api, errorText, IS_LIVE, newKey } from '@/lib/api';
import { cn } from '@/lib/cn';

// الأنواع المسموحة وحدّ الحجم للإيصالات (القسم 15) — ويُفحص المحتوى في الخادم لا الامتداد فقط
const ACCEPT = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_MB = 5;

export function ReceiptUpload({ orderRef, today }: { orderRef: string; today: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState<string>();
  const [sender, setSender] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [key] = useState(newKey);

  if (sent) {
    return (
      <div className="flex items-center gap-3 rounded-ctl bg-success/10 p-4 text-sm text-ink">
        <FileCheck className="size-6 shrink-0 text-success" aria-hidden />
        تمام، استلمنا الإيصال. الطلب الآن بانتظار مراجعة المالية، ويصلك إشعار عند الاعتماد.
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return setFileError('أرفقي صورة الإيصال أو ملف PDF');
        if (sender.trim().length < 2) return setError('اكتبي اسم المحوِّل كما يظهر في الإيصال');
        if (!IS_LIVE) return setSent(true);
        setBusy(true);
        setError(undefined);
        const form = new FormData();
        form.set('file', file);
        form.set('senderName', sender.trim());
        form.set('transferDate', date);
        try {
          await api(`/orders/${orderRef}/receipt`, { form, idempotencyKey: key });
          setSent(true);
          router.refresh();
        } catch (err) {
          setError(errorText(err));
          setBusy(false);
        }
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
      <TextField id="sender" label="اسم المحوِّل" placeholder="كما يظهر في الإيصال" required value={sender} onChange={(e) => setSender(e.target.value)} />
      <TextField id="date" label="تاريخ التحويل" type="date" value={date} max={today} required onChange={(e) => setDate(e.target.value)} />
      {error && <p className="rounded-ctl bg-danger/8 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" block disabled={busy}>
        إرسال الإيصال
      </Button>
    </form>
  );
}
