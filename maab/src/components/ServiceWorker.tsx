'use client';

import { useEffect } from 'react';

/** يسجّل عامل الخدمة في الإنتاج فقط، فلا يتداخل مع إعادة التحميل أثناء التطوير */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* المتصفح يمنع التسجيل (وضع خاص مثلاً) — يبقى الموقع عاملاً بالاتصال */
    });
  }, []);
  return null;
}
