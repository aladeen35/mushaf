import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'أكاديمية مآب لتحفيظ القرآن الكريم',
    short_name: 'مآب',
    description: 'تحفيظ القرآن الكريم عن بُعد للأطفال والنساء بمعلمات فقط.',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5efe2',
    theme_color: '#0e3d31',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
