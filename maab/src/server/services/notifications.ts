// الإشعارات (القسم 11): داخل التطبيق دائماً، وعبر البريد وواتساب حسب
// تفضيلات المستخدم وتفعيل القناة. الإشعار يُكتب في معاملة الحدث نفسه
// (نمط Outbox)، والعامل يرسل ما في الطابور لاحقاً مع إعادة المحاولة.
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { Tx } from '../db/client';
import { notifications, notificationTemplates, users } from '../db/schema';
import { deliverMessage } from '../auth/channels';
import { flagEnabled } from './settings';

export type NotificationEvent =
  | 'session_reminder_24h'
  | 'session_reminder_1h'
  | 'report_ready'
  | 'payment_approved'
  | 'payment_rejected'
  | 'payment_submitted'
  | 'balance_low'
  | 'juz_completed'
  | 'session_changed'
  | 'application_update';

/** نصوص احتياطية إن لم يوجد قالب في القاعدة لهذا الحدث */
const FALLBACK: Record<NotificationEvent, { title: string; body: string }> = {
  session_reminder_24h: { title: 'تذكير بحصة الغد', body: 'حصة {{student}} مع {{teacher}} غدًا {{time}}.' },
  session_reminder_1h: { title: 'الحصة بعد ساعة', body: 'حصة {{student}} {{time}}. يظهر زر الدخول قبل الموعد بعشر دقائق.' },
  report_ready: { title: 'تقرير الحفظ جاهز', body: '{{student}}: {{range}}، تقدير {{grade}}.' },
  payment_approved: { title: 'اعتُمد التحويل', body: 'فُعّلت باقة {{student}}، والحصص في جدولك.' },
  payment_rejected: { title: 'التحويل يحتاج مراجعة', body: 'الطلب {{ref}}: {{reason}}' },
  payment_submitted: { title: 'إيصال جديد للمراجعة', body: 'الطلب {{ref}} بمبلغ {{amount}}.' },
  balance_low: { title: 'رصيد الباقة منخفض', body: 'بقي في باقة {{student}} {{remaining}}.' },
  juz_completed: { title: 'مبروك الشرافة', body: 'أتمّ {{student}} {{juz}}، ربنا يجعله في ميزان حسناتكم.' },
  session_changed: { title: 'تغيّر موعد حصة', body: 'حصة {{student}} أصبحت {{time}}.' },
  application_update: { title: 'تحديث طلب الانضمام', body: '{{message}}' },
};

/** الأحداث التي تستحق رسالة خارج التطبيق افتراضياً */
const EXTERNAL_BY_DEFAULT: NotificationEvent[] = [
  'session_reminder_24h',
  'session_reminder_1h',
  'payment_approved',
  'payment_rejected',
  'juz_completed',
  'session_changed',
  'application_update',
];

export const render = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (vars[k] === undefined ? '' : String(vars[k])));

type Notify = {
  userIds: string[];
  event: NotificationEvent;
  vars?: Record<string, string | number>;
  data?: Record<string, unknown>;
};

export async function notify(tx: Tx, n: Notify): Promise<void> {
  const ids = [...new Set(n.userIds)].filter(Boolean);
  if (!ids.length) return;
  const vars = n.vars ?? {};
  const templates = await tx
    .select()
    .from(notificationTemplates)
    .where(and(eq(notificationTemplates.event, n.event), eq(notificationTemplates.active, true), eq(notificationTemplates.locale, 'ar')));
  const tplFor = (channel: string) => templates.find((t) => t.channel === channel) ?? templates.find((t) => t.channel === 'in_app') ?? FALLBACK[n.event];

  const whatsappOn = await flagEnabled(tx, 'whatsapp');
  const recipients = await tx
    .select({ id: users.id, phone: users.phone, email: users.email, prefs: users.notificationPrefs })
    .from(users)
    .where(and(inArray(users.id, ids), isNull(users.deletedAt)));

  const now = new Date();
  const rows: (typeof notifications.$inferInsert)[] = [];
  for (const r of recipients) {
    const inApp = tplFor('in_app');
    rows.push({ userId: r.id, event: n.event, channel: 'in_app', title: render(inApp.title, vars), body: render(inApp.body, vars), data: n.data, status: 'sent', sentAt: now });
    const prefs = r.prefs?.[n.event] ?? {};
    const wants = (ch: 'whatsapp' | 'email' | 'sms') => prefs[ch] ?? EXTERNAL_BY_DEFAULT.includes(n.event);
    const external: ('whatsapp' | 'email' | 'sms')[] = [];
    if (r.phone && whatsappOn && wants('whatsapp')) external.push('whatsapp');
    if (r.email && wants('email')) external.push('email');
    // الرسالة النصية بتفعيل صريح فقط (تكلفتها أعلى)، وللأرقام السعودية
    if (r.phone?.startsWith('+966') && prefs.sms === true) external.push('sms');
    for (const channel of external) {
      const tpl = tplFor(channel);
      rows.push({ userId: r.id, event: n.event, channel, title: render(tpl.title, vars), body: render(tpl.body, vars), data: n.data });
    }
  }
  if (rows.length) await tx.insert(notifications).values(rows);
}

/** للعامل: يرسل ما في الطابور ويعيد المحاولة حتى 3 مرات (يُحسب من نص الخطأ) */
export async function dispatchQueued(tx: Tx, limit = 50): Promise<{ sent: number; failed: number }> {
  const queued = await tx
    .select({ n: notifications, phone: users.phone, email: users.email })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(and(eq(notifications.status, 'queued'), ne(notifications.channel, 'in_app')))
    .orderBy(asc(notifications.createdAt))
    .limit(limit)
    .for('update', { of: notifications, skipLocked: true });
  let sent = 0;
  let failed = 0;
  for (const { n, phone, email } of queued) {
    const to = n.channel === 'email' ? email : phone;
    try {
      if (!to) throw new Error('لا توجد وسيلة تواصل لهذه القناة');
      await deliverMessage(n.channel as 'whatsapp' | 'sms' | 'email', to, n.title, n.body);
      await tx.update(notifications).set({ status: 'sent', sentAt: new Date(), error: null }).where(eq(notifications.id, n.id));
      sent++;
    } catch (e) {
      const tries = (n.error?.match(/^\[(\d+)\]/)?.[1] ?? '0') as string;
      const attempt = Number(tries) + 1;
      await tx
        .update(notifications)
        .set({ status: attempt >= 3 ? 'failed' : 'queued', error: `[${attempt}] ${(e as Error).message}`.slice(0, 500) })
        .where(eq(notifications.id, n.id));
      failed++;
    }
  }
  return { sent, failed };
}

const PAGE = 30;

/** إشعارات المستخدم داخل التطبيق، بالترقيم بالمؤشر (القسم 14) */
export async function listNotifications(tx: Tx, userId: string, cursor?: string) {
  const rows = await tx
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.channel, 'in_app'),
        // المؤشر معرّف آخر عنصر؛ المقارنة بالصف كاملاً تحفظ دقة الميكروثانية
        cursor ? sql`(${notifications.createdAt}, ${notifications.id}) < (select created_at, id from notifications where id = ${cursor})` : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(PAGE + 1);
  const page = rows.slice(0, PAGE);
  const last = page[page.length - 1];
  return {
    items: page.map((n) => ({ id: n.id, event: n.event, title: n.title, body: n.body, data: n.data, read: Boolean(n.readAt), createdAt: n.createdAt })),
    nextCursor: rows.length > PAGE && last ? last.id : null,
    unread: Number(
      (
        await tx
          .select({ n: sql<number>`count(*)` })
          .from(notifications)
          .where(and(eq(notifications.userId, userId), eq(notifications.channel, 'in_app'), isNull(notifications.readAt)))
      )[0].n,
    ),
  };
}
