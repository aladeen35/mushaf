// يبني نسخة العرض الثابتة في out/ لـGitHub Pages:
//   node scripts/build-static.mjs [--base=/maab]
// نقاط /api/v1 تحتاج خادماً فتُنقل مؤقتاً خارج المشروع أثناء البناء ثم تُعاد،
// وفهرس الآيات يُنسخ إلى public/data للبحث في المتصفح.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const base = process.argv.find((a) => a.startsWith('--base='))?.slice(7) ?? process.env.MAAB_BASE_PATH ?? '';
const api = path.join(root, 'src/app/api');
const parked = path.join(mkdtempSync(path.join(tmpdir(), 'maab-api-')), 'api');
const data = path.join(root, 'public/data');

const restore = () => {
  if (existsSync(parked) && !existsSync(api)) renameSync(parked, api);
};
process.on('SIGINT', () => (restore(), process.exit(130)));

try {
  // نقل لا نسخ: المجلد المؤقت في /tmp قد يكون على قرص آخر، فيُنسخ ثم يُحذف
  cpSync(api, parked, { recursive: true });
  rmSync(api, { recursive: true });
  mkdirSync(data, { recursive: true });
  cpSync(path.join(root, 'src/lib/quran/ayahs.json'), path.join(data, 'ayahs.json'));
  rmSync(path.join(root, 'out'), { recursive: true, force: true });
  execFileSync('npx', ['next', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, MAAB_STATIC: '1', NEXT_PUBLIC_MAAB_MODE: 'demo', MAAB_BASE_PATH: base, MAAB_DATA: 'demo', DATABASE_URL: '' },
  });
  // مع distDir مخصص يكتب Next ملفات التصدير فيه، فيُنقل إلى out/
  const exported = path.join(root, '.next-static');
  if (!existsSync(path.join(root, 'out')) && existsSync(path.join(exported, 'index.html'))) renameSync(exported, path.join(root, 'out'));
  // GitHub Pages: لا معالجة Jekyll، وصفحة 404 للمسارات غير الموجودة
  writeFileSync(path.join(root, 'out/.nojekyll'), '');
  if (existsSync(path.join(root, 'out/404/index.html'))) cpSync(path.join(root, 'out/404/index.html'), path.join(root, 'out/404.html'));
  console.log(`\n✓ النسخة الثابتة في out/${base ? ` بالمسار ${base}` : ''}`);
} finally {
  restore();
  rmSync(data, { recursive: true, force: true });
}
