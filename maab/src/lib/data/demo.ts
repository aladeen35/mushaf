// بيانات العرض بشكل طبقة البيانات — النسخة الثابتة تعمل بها وحدها دون خادم.
import * as demo from '../demo/data';
import { makeDataset } from './queries';
import type { RawData } from './types';

const raw: RawData = {
  guardian: demo.guardian,
  students: demo.students,
  teachers: demo.teachers,
  sessions: demo.sessions,
  reports: demo.reports,
  payments: demo.payments,
  notifications: demo.notifications,
  PRICES: demo.PRICES,
  PAYMENT_ACCOUNTS: demo.PAYMENT_ACCOUNTS,
  monthlyAyahs: demo.monthlyAyahs,
  me: demo.teachers[0],
  teacherStats: demo.teacherStats,
  availability: demo.teacherAvailability,
  teacherToday: demo.teacherToday,
  teacherPendingReports: demo.teacherPendingReports,
  teacherRoster: demo.teacherRoster,
  adminKpis: demo.adminKpis,
  adminQueue: demo.adminQueue,
  pendingPayments: demo.pendingPayments,
  applications: demo.applications,
  audit: demo.adminAudit,
  weeklySessions: demo.adminWeekly,
};

/** ساعة العرض ثابتة لتبقى الحالات متّسقة (حصة مفتوحة الآن، تقرير متأخر…) */
export const demoDataset = makeDataset(raw, () => demo.DEMO_NOW, 'demo');
