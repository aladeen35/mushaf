/**
 * التفعيل التدريجي (القسم 2): جداول المرحلة الثانية ونقاطها موجودة من
 * البداية، وتُفعَّل من لوحة الإدارة عبر جدول feature_flags دون نشر جديد.
 * هذه القيم الافتراضية إلى أن تُقرأ من قاعدة البيانات.
 */
export const FLAGS = {
  electronic_payment: false,
  whatsapp: false,
  group_halaqat: false,
  e_tests: false,
  certificates: false,
  rewards: false,
  english_ui: false,
  smart_review_assistant: false,
  minor_student_login: true,
} as const;

export type Flag = keyof typeof FLAGS;
