// للاستعمال في مكوّنات الخادم فقط: يحمّل نص المصحف (نحو 4 ميجابايت) من الملفات.
import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ayahs from './ayahs.json';
import { juzOf, type AyahRef } from './index';
import resolve from './tafsir/resolve.json';

type AyahRow = [number, number, number, string, string];
const AYAHS = ayahs as AyahRow[];

const pageIndex = new Map<string, number>(AYAHS.map(([s, a, p]) => [`${s}:${a}`, p]));

export function pageOf(ref: AyahRef): number {
  const p = pageIndex.get(`${ref.surah}:${ref.ayah}`);
  if (!p) throw new RangeError(`آية غير صحيحة: ${ref.surah}:${ref.ayah}`);
  return p;
}

export type QuranLine = { t: 's'; s: number } | { t: 'b' } | { t: 'a'; w: (string | number)[] };
export type QuranPage = { j: number; h: number; s: number[]; l: QuranLine[] };

const cache = new Map<number, Record<string, QuranPage>>();

export function loadPage(page: number): QuranPage {
  const chunk = Math.floor((page - 1) / 20);
  if (!cache.has(chunk)) {
    const file = path.join(process.cwd(), 'src/lib/quran/pages', `pages-${String(chunk).padStart(2, '0')}.json`);
    cache.set(chunk, JSON.parse(readFileSync(file, 'utf8')));
  }
  const p = cache.get(chunk)![page];
  if (!p) throw new RangeError(`صفحة غير موجودة: ${page}`);
  return p;
}

export function searchAyahs(key: string, limit = 50) {
  if (key.length < 2) return [];
  const out: { surah: number; ayah: number; page: number; text: string }[] = [];
  for (const [surah, ayah, page, text, k] of AYAHS) {
    if (k.includes(key)) {
      out.push({ surah, ayah, page, text });
      if (out.length >= limit) break;
    }
  }
  return out;
}

// ——— التفسير الميسّر ———


const RESOLVE = resolve as Record<string, string>;
const tafsirCache = new Map<number, Record<string, string>>();

function tafsirJuz(juz: number): Record<string, string> {
  if (!tafsirCache.has(juz)) {
    const file = path.join(process.cwd(), 'src/lib/quran/tafsir', `juz-${String(juz).padStart(2, '0')}.json`);
    tafsirCache.set(juz, JSON.parse(readFileSync(file, 'utf8')));
  }
  return tafsirCache.get(juz)!;
}

export type TafsirEntry = { from: AyahRef; to: AyahRef; text: string };

/** تفسير آيات الصفحة، والمدخل الذي يشمل أكثر من آية يظهر مرة واحدة بنطاقه */
export function tafsirForPage(page: number): TafsirEntry[] {
  const out: TafsirEntry[] = [];
  let last: string | undefined;
  for (const [surah, ayah, p] of AYAHS) {
    if (p !== page) continue;
    const key = RESOLVE[`${surah}:${ayah}`] ?? `${surah}:${ayah}`;
    if (key === last) {
      out[out.length - 1].to = { surah, ayah };
      continue;
    }
    last = key;
    const [s, a] = key.split(':').map(Number);
    const text = tafsirJuz(juzOf({ surah: s, ayah: a }))[key];
    if (text) out.push({ from: { surah, ayah }, to: { surah, ayah }, text });
  }
  return out;
}
