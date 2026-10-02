import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // صفحات المصحف والتفسير تُقرأ من الملفات عند الطلب، فتُضمَّن في حزمة الخادم صراحةً
  outputFileTracingIncludes: {
    '/*/mushaf/*': ['src/lib/quran/pages/**/*', 'src/lib/quran/tafsir/**/*'],
  },
};

export default nextConfig;
