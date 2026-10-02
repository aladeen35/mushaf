// المسار الأساسي للموقع: فارغ في النسخة الحية، و/maab في النسخة الثابتة على
// GitHub Pages. روابط next/link والتنقّل تضيفه تلقائياً؛ أما الملفات من public
// (الصور والأيقونات وعامل الخدمة) فتُبنى روابطها بهذه الدالة.
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const asset = (path: string) => `${BASE}${path}`;
