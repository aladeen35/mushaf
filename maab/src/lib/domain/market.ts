// السوق: السودانيون حول العالم. الدولة تحدّد مفتاح الجوال والعملة وطرق الدفع
// وقنوات رمز الدخول، والمنطقة الزمنية تُحفظ لكل مستخدم ويُعرض بها كل موعد.
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';

export type { CountryCode };

export type Currency = 'SAR' | 'SDG' | 'USD';

export const CURRENCIES: Record<Currency, { name: string; symbol: string }> = {
  SAR: { name: 'ريال سعودي', symbol: 'ر.س' },
  SDG: { name: 'جنيه سوداني', symbol: 'ج.س' },
  USD: { name: 'دولار أمريكي', symbol: 'دولار' },
};

/** الريال للسعودية، والجنيه للسودان، والدولار لبقية الدول */
export function currencyFor(country: CountryCode): Currency {
  if (country === 'SA') return 'SAR';
  if (country === 'SD') return 'SDG';
  return 'USD';
}

/**
 * الدول الأكثر حضوراً للجالية السودانية تظهر أولاً في قائمة الجوال،
 * ولكل منها منطقة زمنية افتراضية تُعدَّل من الملف الشخصي.
 */
export const FEATURED: { code: CountryCode; tz: string }[] = [
  { code: 'SD', tz: 'Africa/Khartoum' },
  { code: 'SA', tz: 'Asia/Riyadh' },
  { code: 'AE', tz: 'Asia/Dubai' },
  { code: 'QA', tz: 'Asia/Qatar' },
  { code: 'OM', tz: 'Asia/Muscat' },
  { code: 'KW', tz: 'Asia/Kuwait' },
  { code: 'BH', tz: 'Asia/Bahrain' },
  { code: 'EG', tz: 'Africa/Cairo' },
  { code: 'GB', tz: 'Europe/London' },
  { code: 'IE', tz: 'Europe/Dublin' },
  { code: 'US', tz: 'America/New_York' },
  { code: 'CA', tz: 'America/Toronto' },
  { code: 'AU', tz: 'Australia/Sydney' },
  { code: 'TR', tz: 'Europe/Istanbul' },
];

const regionNames = new Intl.DisplayNames(['ar'], { type: 'region' });

export type Country = { code: CountryCode; name: string; dial: string; currency: Currency; featured: boolean; tz?: string };

export function country(code: CountryCode): Country {
  const f = FEATURED.find((c) => c.code === code);
  return {
    code,
    name: regionNames.of(code) ?? code,
    dial: `+${getCountryCallingCode(code)}`,
    currency: currencyFor(code),
    featured: !!f,
    tz: f?.tz,
  };
}

/** كل الدول: المميزة بترتيبها أولاً، ثم البقية أبجدياً بالعربية */
export function allCountries(): Country[] {
  const featured = FEATURED.map((c) => country(c.code));
  const rest = getCountries()
    .filter((c) => !FEATURED.some((f) => f.code === c))
    .map(country)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  return [...featured, ...rest];
}

export function defaultTimezone(code: CountryCode, fallback = 'Asia/Riyadh'): string {
  return FEATURED.find((c) => c.code === code)?.tz ?? fallback;
}

const TZ_CITY: Record<string, string> = {
  'Africa/Khartoum': 'الخرطوم',
  'Asia/Riyadh': 'الرياض',
  'Asia/Dubai': 'دبي',
  'Asia/Qatar': 'الدوحة',
  'Asia/Muscat': 'مسقط',
  'Asia/Kuwait': 'الكويت',
  'Asia/Bahrain': 'المنامة',
  'Africa/Cairo': 'القاهرة',
  'Europe/London': 'لندن',
  'Europe/Dublin': 'دبلن',
  'America/New_York': 'نيويورك',
  'America/Toronto': 'تورنتو',
  'Australia/Sydney': 'سيدني',
  'Europe/Istanbul': 'إسطنبول',
};

/** «بتوقيت الخرطوم» — للمناطق غير المعروفة يُعرض اسمها كما هو */
export const timezoneLabel = (tz: string) => TZ_CITY[tz] ?? tz.split('/').pop()!.replace(/_/g, ' ');

// ——— طرق الدفع ———
// كلها في الإطلاق تحويلٌ يدوي برقم مرجعي ثم رفع إيصال تراجعه المالية (القسم 6).

export type PaymentMethod = 'bank_transfer_sa' | 'sudan_transfer' | 'international_transfer' | 'mada' | 'card' | 'apple_pay' | 'stc_pay';

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; hint: string; currency: Currency | null; manual: boolean }> = {
  bank_transfer_sa: { label: 'تحويل بنكي سعودي', hint: 'إلى آيبان الأكاديمية بالريال', currency: 'SAR', manual: true },
  sudan_transfer: { label: 'بنكك أو بنك سوداني', hint: 'تحويل بالجنيه من تطبيق بنكك أو أي بنك في السودان', currency: 'SDG', manual: true },
  international_transfer: { label: 'تحويل دولي', hint: 'حوالة بنكية أو مالية بالدولار من أي دولة', currency: 'USD', manual: true },
  // المرحلة الثانية: بوابة دفع إلكتروني (feature flag: electronic_payment)
  mada: { label: 'مدى', hint: '', currency: 'SAR', manual: false },
  card: { label: 'بطاقة', hint: '', currency: null, manual: false },
  apple_pay: { label: 'Apple Pay', hint: '', currency: null, manual: false },
  stc_pay: { label: 'STC Pay', hint: '', currency: 'SAR', manual: false },
};

/** الطرق المتاحة في الإطلاق لعملة المستخدم */
export function paymentMethodsFor(currency: Currency, electronic = false): PaymentMethod[] {
  return (Object.keys(PAYMENT_METHODS) as PaymentMethod[]).filter((m) => {
    const p = PAYMENT_METHODS[m];
    if (!p.manual && !electronic) return false;
    return p.currency === currency || (p.currency === null && electronic);
  });
}

// ——— قنوات رمز الدخول ———

export type OtpChannel = 'whatsapp' | 'sms' | 'email';

export const OTP_CHANNEL_LABEL: Record<OtpChannel, string> = {
  whatsapp: 'واتساب',
  sms: 'رسالة نصية',
  email: 'البريد الإلكتروني',
};

/**
 * واتساب للجميع أولاً؛ والرسالة النصية احتياطاً للأرقام السعودية وحدها
 * (الرسائل إلى السودان مكلفة وغير مضمونة)، والبريد احتياطاً لغيرها.
 * الدخول بحساب Google متاح للجميع دائماً.
 */
export function otpChannels(code: CountryCode): OtpChannel[] {
  return code === 'SA' ? ['whatsapp', 'sms'] : ['whatsapp', 'email'];
}

export function formatMoney(amount: number, currency: Currency): string {
  const n = amount.toLocaleString('en-US', { maximumFractionDigits: currency === 'SDG' ? 0 : 2 });
  return `${n} ${CURRENCIES[currency].symbol}`;
}
