// مصفوفة الصلاحيات (القسم 3) — مصدر واحد للطبقة الثانية (واجهات API)
// ولجدولي roles وrole_permissions في قاعدة البيانات. الطبقة الثالثة هي سياسات RLS.

export const ROLES = {
  guardian: 'ولي الأمر',
  adult_student: 'الطالبة البالغة',
  minor_student: 'الطالب القاصر',
  teacher: 'المعلمة',
  supervisor: 'المشرفة الأكاديمية',
  finance: 'المالية',
  support: 'الدعم',
  super_admin: 'المدير العام',
} as const;

export type Role = keyof typeof ROLES;

export const PERMISSIONS = {
  'students.read.own': 'رؤية بيانات أبنائه أو ملفها',
  'students.read.assigned': 'رؤية الطلاب المسندين إليها',
  'students.read.names': 'رؤية أسماء الطلاب فقط',
  'students.read.all': 'رؤية كل الطلاب',
  'students.manage': 'إضافة الأبناء وتعديل ملفاتهم',
  'plans.purchase': 'شراء باقة',
  'plans.purchase.on_behalf': 'شراء باقة نيابةً عن ولي الأمر',
  'payments.approve': 'اعتماد التحويلات ورفضها',
  'payments.refund': 'تسجيل الاسترداد',
  'prices.manage': 'الباقات والأسعار والكوبونات وحسابات الاستلام',
  'teachers.approve': 'قبول المعلمات ورفضهن',
  'teachers.assign': 'إسناد الطلاب للمعلمات',
  'sessions.reschedule.self': 'إعادة جدولة ضمن المهلة',
  'sessions.reschedule.request': 'طلب إعادة جدولة بموافقة',
  'sessions.reschedule.any': 'إعادة جدولة أي حصة',
  'reports.write': 'كتابة تقرير الحصة',
  'reports.edit': 'تعديل التقارير',
  'availability.manage.own': 'إدارة أوقات الإتاحة',
  'revenue.read': 'رؤية الإيرادات',
  'support.impersonate': 'الدخول بحساب مستخدم بإذن مسجّل',
  'content.manage': 'المحتوى والأذكار والورد',
  'roles.manage': 'إدارة الأدوار',
  'settings.manage': 'الإعدادات والتفعيل التدريجي',
  'audit.read': 'سجل التدقيق',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  guardian: ['students.read.own', 'students.manage', 'plans.purchase', 'sessions.reschedule.self'],
  adult_student: ['students.read.own', 'plans.purchase', 'sessions.reschedule.self'],
  minor_student: ['students.read.own'],
  teacher: ['students.read.assigned', 'sessions.reschedule.request', 'reports.write', 'availability.manage.own'],
  supervisor: [
    'students.read.all',
    'teachers.approve',
    'teachers.assign',
    'sessions.reschedule.any',
    'reports.edit',
    'content.manage',
  ],
  finance: ['students.read.names', 'plans.purchase.on_behalf', 'payments.approve', 'payments.refund', 'prices.manage', 'revenue.read'],
  support: ['students.read.all', 'sessions.reschedule.any', 'support.impersonate'],
  super_admin: Object.keys(PERMISSIONS) as Permission[],
};

export function can(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r].includes(permission));
}

/** أدوار الإدارة تستلزم مصادقة ثنائية وتنتهي جلستها بعد 30 دقيقة خمول (القسم 15) */
export const STAFF_ROLES: Role[] = ['supervisor', 'finance', 'support', 'super_admin'];
export const isStaff = (roles: readonly Role[]) => roles.some((r) => STAFF_ROLES.includes(r));
