// يولّد نسخ الشعار من الملف الأصلي brand-src/maab-logo-source.png
// (1254×1254 على هامش كريمي): الشعار الكامل بزوايا شفافة، وأيقونات PWA
// العادية وMaskable بخلفية خضراء ممتدة، وأيقونة Apple، والرمز المختصر
// (القوس الذهبي و«مآب» فقط) للأحجام الصغيرة.
//
// تشغيل: npm run brand:icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'brand-src/maab-logo-source.png';
const OUT = 'public/brand';
const ICONS = 'public/icons';
mkdirSync(OUT, { recursive: true });
mkdirSync(ICONS, { recursive: true });

// حدود المربع الأخضر داخل الملف الأصلي (مقيسة من البكسلات).
const SQ = { left: 84, top: 80, size: 1086 };
const RADIUS = 0.22; // نسبة نصف قطر زاوية الرمز المختصر إلى الضلع
// منطقة القوس و«مآب» فوق سطر «لتحفيظ القرآن».
const ARCH = { left: 236, top: 104, width: 782, height: 600 };
const GREEN = '#0E3D31';
const GREEN_DEEP = '#03291F';

const greenCanvas = (size, rounded = false) =>
  Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1F5646"/><stop offset=".55" stop-color="${GREEN}"/><stop offset="1" stop-color="${GREEN_DEEP}"/>
      </linearGradient></defs>
      <rect width="${size}" height="${size}" ${rounded ? `rx="${size * RADIUS}"` : ''} fill="url(#g)"/>
    </svg>`,
  );

// يجعل المنطقة المتّصلة بحواف الصورة والمطابقة للشرط شفّافة (ملء من الحواف)،
// فيبقى ما أحاطت به الحدود سليماً حتى لو شابه لونُه لونَ الخلفية.
async function keyFromEdges(input, isBackground) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const alpha = Buffer.alloc(w * h, 255);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const test = (i) => isBackground(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || !test(i)) continue;
    seen[i] = 1;
    alpha[i] = 0;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  const soft = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(1.2).extractChannel(0).raw().toBuffer();
  return sharp(data, { raw: { width: w, height: h, channels: 3 } }).joinChannel(soft, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
// خلفية الشعار الكريمية وظلّه الرمادي الخفيف
const isCreamBackground = (r, g, b) => lum(r, g, b) > 178 && Math.max(r, g, b) - Math.min(r, g, b) < 40;
// أخضر المربع حول القوس
const isLogoGreen = (r, g, b) => g >= r + 12 && r < 120 && lum(r, g, b) < 140;

const square = await sharp(SRC)
  .extract({ left: SQ.left, top: SQ.top, width: SQ.size, height: SQ.size })
  .toBuffer();

// الشعار الكامل بزوايا شفافة
const full = await keyFromEdges(SRC, isCreamBackground).then((b) =>
  sharp(b).extract({ left: SQ.left, top: SQ.top, width: SQ.size, height: SQ.size }).png().toBuffer(),
);
const archOnly = await sharp(SRC).extract(ARCH).toBuffer().then((b) => keyFromEdges(b, isLogoGreen));
await sharp(full).resize(720).png({ compressionLevel: 9 }).toFile(`${OUT}/logo-full.png`);
for (const s of [192, 512]) {
  await sharp(full).resize(s).png({ compressionLevel: 9 }).toFile(`${ICONS}/icon-${s}.png`);
}

// Maskable: خلفية خضراء حتى حواف المربع، والشعار داخل المنطقة الآمنة
for (const s of [192, 512]) {
  const inner = Math.round(s * 0.84);
  const logo = await sharp(full).resize(inner).toBuffer();
  await sharp(greenCanvas(s))
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(`${ICONS}/icon-${s}-maskable.png`);
}

// Apple: مربع معتم تقصّ زواياه iOS بنفسها
{
  const s = 180;
  const logo = await sharp(square).resize(s).toBuffer();
  await sharp(greenCanvas(s)).composite([{ input: logo }]).png().toFile(`${ICONS}/apple-touch-icon.png`);
}

// الرمز المختصر: القوس الذهبي و«مآب» على مربع أخضر
{
  const s = 512;
  const arch = await sharp(archOnly).resize({ height: Math.round(s * 0.74) }).toBuffer();
  const meta = await sharp(arch).metadata();
  const mark = await sharp(greenCanvas(s, true))
    .composite([{ input: arch, left: Math.round((s - meta.width) / 2), top: Math.round(s * 0.16) }])
    .png()
    .toBuffer();
  // القوس يُقصّ أفقياً عند أسفل المربع فيبدو محراباً قاعدته مستوية
  await sharp(mark).png({ compressionLevel: 9 }).toFile(`${OUT}/logo-mark.png`);
  await sharp(mark).resize(64).png().toFile(`${ICONS}/favicon-64.png`);
  await sharp(mark).resize(32).png().toFile(`${ICONS}/favicon-32.png`);
  await sharp(mark).resize(16).png().toFile(`${ICONS}/favicon-16.png`);
}

// القوس وحده بلا خلفية للشريط العلوي (يُقصّ المحراب من الشعار)
{
  await sharp(archOnly).resize({ height: 240 }).png({ compressionLevel: 9 }).toFile(`${OUT}/arch.png`);
}

console.log('brand assets written');
