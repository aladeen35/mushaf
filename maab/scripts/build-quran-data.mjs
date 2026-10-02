// يبني بيانات المصحف لأكاديمية مآب من بيانات تطبيق بُشرى في المستودع نفسه
// (../app/data): صفحات مصحف المدينة الـ604 بأسطرها الخمسة عشر، وجدول
// السور والأجزاء المرجعي (القسم 9 و10 من المواصفات).
//
// المخرجات:
//   src/lib/quran/surahs.json  — رقم السورة واسمها وعدد آياتها ومكان نزولها وصفحتها الأولى
//   src/lib/quran/juz.json     — بداية كل جزء (سورة:آية) وصفحتها
//   src/lib/quran/pages/pages-XX.json — الصفحات مجمّعة كل 20 صفحة، كل سطر:
//       {t:"s", s}  عنوان سورة | {t:"b"} بسملة | {t:"a", w:[...]} كلمات، والرقم نهاية آية
//   src/lib/quran/ayahs.json — لكل آية: [سورة، آية، صفحة، النص، مفتاح البحث]
//   src/lib/quran/tafsir/    — التفسير الميسّر (مجمع الملك فهد) مقسوماً بالأجزاء، وresolve.json
//       يربط كل آية بمدخل التفسير الذي يشملها (بعض المداخل تجمع أكثر من آية)
//
// تشغيل: npm run quran:data
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const SRC = '../app/data';
const CHUNK = 20;

// بدايات الأجزاء المعتمدة (Tanzil). بعضها يقع وسط الصفحة، فلا يُستنتج من ترقيم الصفحات.
const JUZ_STARTS = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

// تصحيح إملاء بعض أسماء السور في المصدر (همزات القطع والوصل)
const NAME_FIXES = { 14: 'إبراهيم', 34: 'سبأ', 76: 'الإنسان', 78: 'النبأ', 82: 'الانفطار', 84: 'الانشقاق' };
const surahs = JSON.parse(readFileSync(`${SRC}/surahs.json`, 'utf8')).map((s) => ({ ...s, name: NAME_FIXES[s.id] ?? s.name }));
const pages = {};
for (let i = 0; i < Math.ceil(604 / CHUNK); i++) {
  Object.assign(pages, JSON.parse(readFileSync(`${SRC}/pages/chunk-${String(i).padStart(2, '0')}.json`, 'utf8')));
}

const ayahPage = new Map();
const ayahWords = new Map();
const pageFirstAyah = new Map();
const out = {};
for (let p = 1; p <= 604; p++) {
  const page = pages[p];
  const lines = page.lines.map((line) => {
    if (line.type === 'surah') return { t: 's', s: line.surah };
    if (line.type === 'basmalah') return { t: 'b' };
    return {
      t: 'a',
      w: line.words.map((w) => {
        const [s, a] = w.k.split(':').map(Number);
        const key = `${s}:${a}`;
        if (!ayahPage.has(key)) ayahPage.set(key, p);
        if (!pageFirstAyah.has(p)) pageFirstAyah.set(p, key);
        if (!w.e) ayahWords.set(key, [...(ayahWords.get(key) ?? []), w.t]);
        return w.e ? w.n : w.t;
      }),
    };
  });
  out[p] = { j: page.juz, h: page.hizb, s: page.surahs, l: lines };
}

const total = surahs.reduce((n, s) => n + s.ayahs, 0);
if (total !== 6236 || ayahPage.size !== 6236) throw new Error(`عدد الآيات غير مطابق: ${total} / ${ayahPage.size}`);

// مفتاح البحث — مطابق لـ searchKey في src/lib/quran/search.ts (يتحقق منه اختبار).
// يتجاهل التشكيل وعلامات الضبط، ويحذف الألف بصوره كلها فيطابق «الصلاة» رسمَ
// «ٱلصَّلَوٰة» و«الطاغوت» رسمَ «ٱلطَّـٰغُوت»، ويوحّد الياء والتاء المربوطة.
const searchKey = (t) =>
  t
    .replace(/\u0648\u0670/g, '\u0627')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0627\u0671-\u0673]/g, '')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/\s+/g, ' ')
    .trim();

mkdirSync('src/lib/quran/pages', { recursive: true });

writeFileSync(
  'src/lib/quran/surahs.json',
  JSON.stringify(surahs.map((s) => ({ id: s.id, name: s.name, ayahs: s.ayahs, place: s.place, startPage: s.startPage }))),
);
writeFileSync(
  'src/lib/quran/juz.json',
  JSON.stringify(
    JUZ_STARTS.map(([s, a], i) => {
      const key = `${s}:${a}`;
      return { juz: i + 1, surah: s, ayah: a, page: ayahPage.get(key), pageStart: pageFirstAyah.get(ayahPage.get(key)) === key };
    }),
  ),
);
const ayahs = [];
for (const s of surahs) {
  for (let a = 1; a <= s.ayahs; a++) {
    const text = ayahWords.get(`${s.id}:${a}`).join(' ');
    ayahs.push([s.id, a, ayahPage.get(`${s.id}:${a}`), text, searchKey(text)]);
  }
}
writeFileSync('src/lib/quran/ayahs.json', JSON.stringify(ayahs));
for (let i = 0; i < Math.ceil(604 / CHUNK); i++) {
  const chunk = {};
  for (let p = i * CHUNK + 1; p <= Math.min(604, (i + 1) * CHUNK); p++) chunk[p] = out[p];
  writeFileSync(`src/lib/quran/pages/pages-${String(i).padStart(2, '0')}.json`, JSON.stringify(chunk));
}
mkdirSync('src/lib/quran/tafsir', { recursive: true });
const tafsirIndex = JSON.parse(readFileSync(`${SRC}/tafsir/index.json`, 'utf8'));
writeFileSync('src/lib/quran/tafsir/resolve.json', JSON.stringify(tafsirIndex.resolve));
for (let j = 1; j <= 30; j++) {
  const f = `juz-${String(j).padStart(2, '0')}.json`;
  copyFileSync(`${SRC}/tafsir/${f}`, `src/lib/quran/tafsir/${f}`);
}

console.log('quran data: 604 pages, 114 surahs, 30 juz, tafsir');
