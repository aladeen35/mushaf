import type { Metadata, Viewport } from 'next';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';
import '@fontsource/amiri-quran/400.css';
import { ServiceWorker } from '@/components/ServiceWorker';
import './globals.css';
import { asset } from '@/lib/base';

export const metadata: Metadata = {
  title: {
    default: 'أكاديمية مآب لتحفيظ القرآن الكريم',
    template: '%s · مآب',
  },
  description: 'تحفيظ القرآن الكريم عن بُعد للأطفال والنساء بمعلمات فقط، مع متابعة الحفظ والمراجعة لولي الأمر.',
  applicationName: 'مآب',
  appleWebApp: { capable: true, title: 'مآب', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: asset('/icons/favicon-32.png'), sizes: '32x32', type: 'image/png' },
      { url: asset('/icons/favicon-64.png'), sizes: '64x64', type: 'image/png' },
    ],
    apple: asset('/icons/apple-touch-icon.png'),
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0e3d31' },
    { media: '(prefers-color-scheme: dark)', color: '#071712' },
  ],
};

// يطبّق الوضع المختار قبل أول رسم حتى لا تومض الصفحة بالوضع الآخر
const themeScript = `try{var t=localStorage.getItem('maab-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
