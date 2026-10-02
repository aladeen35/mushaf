// أذكار الصباح والمساء من بيانات تطبيق بُشرى (../app/data/adhkar.json).
// محتوى الأذكار تعدّه الإدارة وتراجعه المشرفة الأكاديمية (القسم 10)؛ هذا محتوى ابتدائي.
// تشغيل: npm run content:adhkar
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const KEEP = ['morning', 'evening'];
const { sections } = JSON.parse(readFileSync('../app/data/adhkar.json', 'utf8'));
const out = sections
  .filter((s) => KEEP.includes(s.key))
  .map((s) => ({ key: s.key, name: s.name, hint: s.hint, items: s.items.map(({ text, count, virtue }) => ({ text, count, virtue })) }));
mkdirSync('src/lib/content', { recursive: true });
writeFileSync('src/lib/content/adhkar.json', JSON.stringify(out));
console.log('adhkar:', out.map((s) => `${s.name} ${s.items.length}`).join('، '));
