import type { NextConfig } from 'next';

// النسخة الثابتة لـGitHub Pages: MAAB_STATIC=1 مع NEXT_PUBLIC_MAAB_MODE=demo،
// وتُبنى بـ npm run build:static (يستبعد نقاط /api مؤقتاً لأنها تحتاج خادماً)
const STATIC = process.env.MAAB_STATIC === '1';
const BASE = process.env.MAAB_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  ...(BASE ? { basePath: BASE } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: BASE },
  ...(STATIC
    ? {
        output: 'export',
        trailingSlash: true,
        images: { unoptimized: true },
        distDir: '.next-static',
        // الأنواع تُفحص في CI بـ npm run typecheck؛ هنا تُستبعد نقاط /api مؤقتاً فتشير
        // إليها أنواع مولّدة قديمة في .next
        typescript: { ignoreBuildErrors: true },
      }
    : {
        // صفحات المصحف والتفسير تُقرأ من الملفات عند الطلب، فتُضمَّن في حزمة الخادم صراحةً
        outputFileTracingIncludes: {
          '/*/mushaf/*': ['src/lib/quran/pages/**/*', 'src/lib/quran/tafsir/**/*'],
        },
      }),
};

export default nextConfig;
