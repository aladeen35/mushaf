/**
 * جوال سعودي: 9 أرقام تبدأ بـ5، ويُقبل الصفر أو مفتاح الدولة في أوله
 * والأرقام العربية المشرقية. يعيد الرقم المحلي (5XXXXXXXX) أو null.
 */
export function normalizeSaudiMobile(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const local = digits.replace(/^(\+?966|00966|0)/, '');
  return /^5\d{8}$/.test(local) ? local : null;
}
