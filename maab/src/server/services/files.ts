// الملفات (القسم 15): كل ملف خاص افتراضياً. النوع يُفحص من محتوى الملف لا من
// امتداده، ويُعاد تسميته بـUUID، وتُزال بيانات EXIF من الصور. الوصول بروابط
// موقّعة صالحة 5 دقائق تُصدر فقط بعد فحص الملكية والدور.
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Tx } from '../db/client';
import { files } from '../db/schema';
import { ApiError } from '../api/http';
import { env } from '../env';

export type FileKind = (typeof files.$inferSelect)['kind'];
export type FileRow = typeof files.$inferSelect;

const MB = 1024 * 1024;
export const LIMITS = { document: 5 * MB, audio: 10 * MB };
export const SIGNED_URL_TTL_SEC = 300;

const BUCKET: Record<FileKind, string> = {
  receipt: 'receipts',
  id_document: 'teacher-docs',
  ijazah: 'teacher-docs',
  certificate: 'teacher-docs',
  recording: 'recordings',
  avatar: 'avatars',
};

const EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
};

/** النوع الحقيقي من البايتات الأولى */
export function sniffMime(b: Uint8Array): string | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((x, k) => b[i + k] === x);
  if (at(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0x49, 0x44, 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (at(4, 0x66, 0x74, 0x79, 0x70)) {
    const brand = String.fromCharCode(...b.slice(8, 12));
    if (['M4A ', 'M4B ', 'mp42', 'isom', 'iso2', 'dash'].includes(brand)) return 'audio/mp4';
  }
  return null;
}

/** يتحقق من النوع والحجم ثم يزيل بيانات الصورة الوصفية (الموقع والجهاز) */
export async function sanitize(kind: FileKind, bytes: Uint8Array): Promise<{ bytes: Uint8Array; mime: string }> {
  const mime = sniffMime(bytes);
  const audio = kind === 'recording';
  const allowed = audio ? ['audio/mpeg', 'audio/mp4'] : ['application/pdf', 'image/jpeg', 'image/png'];
  if (!mime || !allowed.includes(mime)) {
    throw new ApiError(422, 'file_type', audio ? 'الصوت بصيغة MP3 أو M4A فقط' : 'الملف بصيغة PDF أو JPG أو PNG فقط');
  }
  const max = audio ? LIMITS.audio : LIMITS.document;
  if (bytes.byteLength > max) throw new ApiError(422, 'file_too_large', `الحد الأقصى ${max / MB} ميجابايت`);
  if (mime === 'image/jpeg' || mime === 'image/png') {
    const sharp = (await import('sharp')).default;
    // rotate() يطبّق اتجاه EXIF قبل حذفه، والمخرَج بلا بيانات وصفية افتراضياً
    const img = sharp(bytes, { failOn: 'error' }).rotate();
    const out = mime === 'image/png' ? await img.png().toBuffer() : await img.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return { bytes: new Uint8Array(out), mime };
  }
  return { bytes, mime };
}

// —— التخزين: محلي للتطوير، وSupabase Storage (Buckets خاصة) للإنتاج ——

/** مجلد التخزين المحلي؛ يُحسب وقت التشغيل فلا يتتبّعه المجمّع كملف من المشروع */
const storageRoot = () => path.resolve(env().STORAGE_DIR);

async function putObject(bucket: string, key: string, bytes: Uint8Array, mime: string) {
  const e = env();
  if (e.STORAGE_DRIVER === 'supabase') {
    const res = await fetch(`${e.SUPABASE_URL}/storage/v1/object/${bucket}/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': mime, 'x-upsert': 'false' },
      body: Buffer.from(bytes),
    });
    if (!res.ok) throw new Error(`Supabase Storage ${res.status}: ${await res.text()}`);
    return;
  }
  const dir = path.join(storageRoot(), bucket);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), bytes, { flag: 'wx' });
}

export async function readObject(file: Pick<FileRow, 'bucket' | 'path'>): Promise<Uint8Array> {
  const e = env();
  if (e.STORAGE_DRIVER === 'supabase') {
    const res = await fetch(`${e.SUPABASE_URL}/storage/v1/object/${file.bucket}/${file.path}`, {
      headers: { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!res.ok) throw new Error(`Supabase Storage ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  return new Uint8Array(await readFile(path.join(storageRoot(), file.bucket, path.basename(file.path))));
}

/** يحفظ الملف بعد فحصه ويسجّله؛ يُستدعى داخل معاملة الإجراء الذي يخصّه */
export async function storeFile(tx: Tx, input: { ownerId: string | null; kind: FileKind; bytes: Uint8Array }): Promise<FileRow> {
  const clean = await sanitize(input.kind, input.bytes);
  const bucket = BUCKET[input.kind];
  const key = `${randomUUID()}.${EXT[clean.mime]}`;
  await putObject(bucket, key, clean.bytes, clean.mime);
  const [row] = await tx
    .insert(files)
    .values({
      ownerId: input.ownerId,
      kind: input.kind,
      bucket,
      path: key,
      mime: clean.mime,
      sizeBytes: clean.bytes.byteLength,
      sha256: createHash('sha256').update(clean.bytes).digest('hex'),
    })
    .returning();
  return row;
}

/** يقرأ ملفاً مرفوعاً من نموذج multipart */
export async function fileFromForm(form: FormData, field: string): Promise<Uint8Array | null> {
  const f = form.get(field);
  if (!f || typeof f === 'string') return null;
  if (f.size > LIMITS.audio) throw new ApiError(422, 'file_too_large', 'الملف أكبر من المسموح');
  return new Uint8Array(await f.arrayBuffer());
}

// —— الروابط الموقّعة ——

const signature = (fileId: string, exp: number) => createHmac('sha256', env().AUTH_SECRET).update(`file:${fileId}:${exp}`).digest('base64url');

/** رابط مؤقت بعد التحقق من حق الوصول (يتحقق المستدعي بقراءة الملف عبر RLS) */
export async function signedUrl(file: Pick<FileRow, 'id' | 'bucket' | 'path'>, now = Date.now()): Promise<{ url: string; expiresAt: string }> {
  const e = env();
  const exp = Math.floor(now / 1000) + SIGNED_URL_TTL_SEC;
  if (e.STORAGE_DRIVER === 'supabase') {
    const res = await fetch(`${e.SUPABASE_URL}/storage/v1/object/sign/${file.bucket}/${file.path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SEC }),
    });
    if (!res.ok) throw new Error(`Supabase Storage ${res.status}`);
    const { signedURL } = (await res.json()) as { signedURL: string };
    return { url: `${e.SUPABASE_URL}/storage/v1${signedURL}`, expiresAt: new Date(exp * 1000).toISOString() };
  }
  return { url: `/api/v1/files/${file.id}/content?exp=${exp}&sig=${signature(file.id, exp)}`, expiresAt: new Date(exp * 1000).toISOString() };
}

export function verifySignature(fileId: string, exp: number, sig: string, now = Date.now()): boolean {
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const a = Buffer.from(signature(fileId, exp));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
