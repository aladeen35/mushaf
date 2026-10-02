// لوحة الإدارة (القسم 12): المؤشرات حسب الدور، وسجل التدقيق، والتصدير،
// والدخول بحساب مستخدم لغرض الدعم بإذن وسبب مسجّلين.
import { and, desc, eq, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { can, isStaff } from '@/lib/domain/permissions';
import { asSystem } from '../db/client';
import {
  auditLogs,
  guardians,
  orders,
  payments,
  sessionReports,
  sessions,
  students,
  subscriptions,
  teacherApplications,
  teacherDisciplineEvents,
  teachers,
  users,
} from '../db/schema';
import { ApiError, forbidden, notFound } from '../api/http';
import type { Viewer } from '../api/route';
import { rolesOf } from '../auth/users';
import { audit } from './audit';
import { getSettings } from './settings';

const DAY = 86_400_000;
const n = sql<number>`count(*)::int`;

export async function dashboard(viewer: Viewer, now = new Date()) {
  if (!isStaff(viewer.roles)) throw forbidden();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return asSystem(viewer.userId, async (tx) => {
    const cfg = await getSettings(tx, ['report_deadline_hours']);
    const [[active], [today], [pending], [apps], [late], [absences]] = await Promise.all([
      tx.select({ n }).from(subscriptions).where(eq(subscriptions.status, 'active')),
      tx.select({ n }).from(sessions).where(and(eq(sessions.status, 'scheduled'), gte(sessions.startsAt, dayStart), lt(sessions.startsAt, new Date(dayStart.getTime() + DAY)))),
      tx.select({ n }).from(payments).where(eq(payments.status, 'under_review')),
      tx.select({ n }).from(teacherApplications).where(and(inArray(teacherApplications.status, ['new', 'under_review', 'needs_info', 'interview']), isNull(teacherApplications.deletedAt))),
      tx
        .select({ n })
        .from(sessions)
        .leftJoin(sessionReports, eq(sessionReports.sessionId, sessions.id))
        .where(and(eq(sessions.status, 'scheduled'), isNull(sessionReports.id), lte(sessions.endsAt, new Date(now.getTime() - cfg.report_deadline_hours * 3_600_000)))),
      tx.select({ n }).from(teacherDisciplineEvents).where(and(eq(teacherDisciplineEvents.kind, 'absent_unexcused'), gte(teacherDisciplineEvents.createdAt, monthStart))),
    ]);
    const out: Record<string, unknown> = {
      activeSubscriptions: active.n,
      sessionsToday: today.n,
      paymentsPending: pending.n,
      applicationsOpen: apps.n,
      reportsLate: late.n,
      teacherAbsencesMonth: absences.n,
    };
    // الإيرادات لمن يملك صلاحيتها فقط، ولكل عملة على حدة (لا جمع بين عملات)
    if (can(viewer.roles, 'revenue.read')) {
      const revenue = await tx
        .select({ currency: payments.currency, total: sql<number>`coalesce(sum(${payments.amount}), 0)::float` })
        .from(payments)
        .where(and(eq(payments.status, 'approved'), gte(payments.reviewedAt, monthStart)))
        .groupBy(payments.currency);
      out.revenueMonth = Object.fromEntries(revenue.map((r) => [r.currency, r.total]));
    }
    return out;
  });
}

export async function auditLog(viewer: Viewer, q: { entity?: string; entityId?: string; before?: number; limit?: number }) {
  if (!can(viewer.roles, 'audit.read')) throw forbidden();
  const limit = Math.min(q.limit ?? 50, 200);
  return asSystem(viewer.userId, async (tx) => {
    const rows = await tx
      .select({ log: auditLogs, actor: users.fullName })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(and(q.entity ? eq(auditLogs.entity, q.entity) : undefined, q.entityId ? eq(auditLogs.entityId, q.entityId) : undefined, q.before ? lt(auditLogs.id, q.before) : undefined))
      .orderBy(desc(auditLogs.id))
      .limit(limit);
    return { items: rows.map((r) => ({ ...r.log, actorName: r.actor })), nextCursor: rows.length === limit ? rows[rows.length - 1].log.id : null };
  });
}

/** الدخول بحساب مستخدم للدعم: لغير حسابات الإدارة، بسبب مكتوب، ويُسجَّل */
export async function startImpersonation(viewer: Viewer, input: { userId: string; reason: string }, ip?: string | null) {
  if (!can(viewer.roles, 'support.impersonate')) throw forbidden();
  if (viewer.impersonatedBy) throw new ApiError(409, 'already_impersonating', 'أنهي الدخول الحالي أولاً');
  return asSystem(viewer.userId, async (tx) => {
    const [target] = await tx.select().from(users).where(and(eq(users.id, input.userId), isNull(users.deletedAt)));
    if (!target) throw notFound('المستخدم');
    const roles = await rolesOf(tx, target.id);
    if (isStaff(roles)) throw new ApiError(403, 'staff_target', 'لا يُدخل بحساب موظف');
    await audit(tx, viewer, { action: 'support.impersonate', entity: 'users', entityId: target.id, reason: input.reason }, ip);
    return { userId: target.id, roles };
  });
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** تصدير CSV بترميز UTF-8 مع BOM ليفتحه Excel بالعربية سليمة */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '﻿';
  const cols = Object.keys(rows[0]);
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
}

export type ExportType = 'payments' | 'sessions' | 'teachers';

export async function exportRows(viewer: Viewer, type: ExportType, range: { from: Date; to: Date }) {
  const need = { payments: 'revenue.read', sessions: 'students.read.all', teachers: 'teachers.approve' } as const;
  if (!can(viewer.roles, need[type])) throw forbidden();
  return asSystem(viewer.userId, async (tx) => {
    let rows: Record<string, unknown>[];
    if (type === 'payments') {
      rows = await tx
        .select({ ref: orders.ref, status: payments.status, method: payments.method, currency: payments.currency, amount: payments.amount, guardian: users.fullName, created_at: payments.createdAt, reviewed_at: payments.reviewedAt })
        .from(payments)
        .innerJoin(orders, eq(orders.id, payments.orderId))
        .innerJoin(guardians, eq(guardians.id, orders.guardianId))
        .innerJoin(users, eq(users.id, guardians.userId))
        .where(and(gte(payments.createdAt, range.from), lt(payments.createdAt, range.to)))
        .orderBy(payments.createdAt);
    } else if (type === 'sessions') {
      rows = await tx
        .select({ starts_at: sessions.startsAt, status: sessions.status, student: students.displayName, teacher: teachers.displayName, makeup: sessions.isMakeup, grade: sessionReports.grade, mastery: sessionReports.mastery })
        .from(sessions)
        .innerJoin(students, eq(students.id, sessions.studentId))
        .innerJoin(teachers, eq(teachers.id, sessions.teacherId))
        .leftJoin(sessionReports, eq(sessionReports.sessionId, sessions.id))
        .where(and(gte(sessions.startsAt, range.from), lt(sessions.startsAt, range.to)))
        .orderBy(sessions.startsAt);
    } else {
      rows = await tx
        .select({
          teacher: teachers.displayName,
          status: teachers.status,
          students: sql<number>`(select count(*) from students s where s.teacher_id = ${teachers.id} and s.deleted_at is null)::int`,
          sessions_done: sql<number>`(select count(*) from sessions s where s.teacher_id = ${teachers.id} and s.status = 'completed' and s.starts_at >= ${range.from} and s.starts_at < ${range.to})::int`,
          absences: sql<number>`(select count(*) from teacher_discipline_events d where d.teacher_id = ${teachers.id} and d.kind = 'absent_unexcused' and d.created_at >= ${range.from} and d.created_at < ${range.to})::int`,
          late_reports: sql<number>`(select count(*) from teacher_discipline_events d where d.teacher_id = ${teachers.id} and d.kind = 'report_late' and d.created_at >= ${range.from} and d.created_at < ${range.to})::int`,
        })
        .from(teachers)
        .where(isNull(teachers.deletedAt))
        .orderBy(teachers.displayName);
    }
    await audit(tx, viewer, { action: 'export', entity: type, after: { from: range.from, to: range.to, rows: rows.length } });
    return rows;
  });
}

