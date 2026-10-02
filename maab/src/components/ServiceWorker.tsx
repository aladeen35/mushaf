'use client';

import { useEffect } from 'react';
import { asset } from '@/lib/base';

/** يسجّل عامل الخدمة في الإنتاج فقط، فلا يتداخل مع إعادة التحميل أثناء التطوير */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(asset('/sw.js'), { scope: asset('/') }).catch(() => {
      /* المتصفح يمنع التسجيل (وضع خاص مثلاً) — يبقى الموقع عاملاً بالاتصال */
    });
  }, []);
  return null;
}
