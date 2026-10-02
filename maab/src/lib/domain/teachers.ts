// مسار قبول المعلمات وانضباطهن (القسم 5).

export type ApplicationStatus = 'new' | 'under_review' | 'needs_info' | 'interview' | 'accepted' | 'rejected';

export const APPLICATION_STATUS: Record<
  ApplicationStatus,
  { label: string; tone: 'neutral' | 'gold' | 'warning' | 'brand' | 'success' | 'danger' }
> = {
  new: { label: 'طلب جديد', tone: 'neutral' },
  under_review: { label: 'قيد المراجعة', tone: 'gold' },
  needs_info: { label: 'يحتاج معلومات', tone: 'warning' },
  interview: { label: 'مقابلة تسميع', tone: 'brand' },
  accepted: { label: 'مقبولة ونشطة', tone: 'success' },
  rejected: { label: 'مرفوضة مع السبب', tone: 'danger' },
};

export const APPLICATION_FLOW: ApplicationStatus[] = ['new', 'under_review', 'interview', 'accepted'];

const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  new: ['under_review', 'rejected'],
  under_review: ['needs_info', 'interview', 'rejected'],
  needs_info: ['under_review', 'rejected'],
  interview: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
};

export function canMoveApplication(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export const REAPPLY_AFTER_DAYS = 90;

export type RequiredDocument = { key: string; label: string; required: boolean; note?: string };

export const TEACHER_DOCUMENTS: RequiredDocument[] = [
  { key: 'national_id', label: 'الهوية أو جواز السفر', required: true, note: 'تخزين خاص لا يراه إلا المشرفة والمدير العام' },
  { key: 'ijazah', label: 'إجازة في القرآن أو شهادة حفظ', required: true, note: 'مع اسم المُجيز والرواية' },
  { key: 'degree', label: 'مؤهل علمي شرعي أو تربوي', required: false },
  { key: 'tajweed', label: 'شهادات دورات التجويد', required: false },
  { key: 'recording', label: 'تسجيل صوتي لتلاوة قصيرة', required: true, note: 'بحد أقصى 3 دقائق' },
  { key: 'experience', label: 'الخبرة السابقة', required: true, note: 'الجهات والسنوات والفئات العمرية' },
];

/** ثلاث غيابات دون عذر في شهر تُوقف المعلمة تلقائياً حتى تراجعها المشرفة */
export const UNEXCUSED_ABSENCE_LIMIT = 3;

export function shouldSuspend(unexcusedAbsencesThisMonth: number): boolean {
  return unexcusedAbsencesThisMonth >= UNEXCUSED_ABSENCE_LIMIT;
}
