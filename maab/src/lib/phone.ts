import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

const EASTERN = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** يحوّل الأرقام العربية المشرقية والفارسية إلى غربية */
export function westernDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(EASTERN.indexOf(d))).replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)));
}

export type ParsedPhone = { e164: string; country: CountryCode; national: string };

/**
 * رقم جوال دولي: يُقبل بمفتاح الدولة (+249…، 00249…) أو محلياً بحسب الدولة
 * المختارة، وبالأرقام المشرقية. يعيد الصيغة الموحّدة E.164 أو null.
 */
export function parsePhone(input: string, defaultCountry: CountryCode): ParsedPhone | null {
  const cleaned = westernDigits(input).replace(/[\s\-().]/g, '').replace(/^00/, '+');
  if (!cleaned) return null;
  const p = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!p || !p.isValid()) return null;
  // الأرقام غير الجغرافية بلا دولة تُنسب للدولة المختارة في النموذج
  return { e164: p.number, country: p.country ?? defaultCountry, national: p.formatNational() };
}

/** عرض الرقم بصيغة دولية مقروءة: +249 91 234 5678 */
export function displayPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
