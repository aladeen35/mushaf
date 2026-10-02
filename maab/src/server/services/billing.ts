// الباقات والطلبات والدفع (القسم 6): السعر بعملة دولة ولي الأمر، والطلب يحجز
// أوقات الحصص مؤقتاً 72 ساعة حتى يُعتمد التحويل. الدفع سجلّ لا يُحذف ولا
// يتغيّر مبلغه، والاسترداد حركة عكسية مستقلة.
import { and, asc, desc, eq, inArray, lt, sql, sum } from 'drizzle-orm';
import { applyCoupon, canTransition, type PaymentStatus } from '@/lib/domain/billing';
import { PAYMENT_METHODS, paymentMethodsFor, type Currency, type PaymentMethod } from '@/lib/domain/market';
import { can } from '@/lib/domain/permissions';
import { teacherCategory } from '@/lib/domain/students';
import { ageOn } from './students';
import { asSystem, asUser, type Tx } from '../db/client';
import {
  couponRedemptions,
  coupons,
  files,
  guardians,
  guardianStudents,
  orderItems,
  orders,
  paymentAccounts,
  paymentReceipts,
  payments,
  planPrices,
  plans,
  recurringSlots,
  refunds,
  sessions,
  students,
  subscriptions,
  users,
} from '../db/schema';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../api/http';
import type { Viewer } from '../api/route';
import { audit } from './audit';
import { requestMeetings } from './meetings';
import { notify } from './notifications';
import { isFree, planOccurrences, teacherCalendar, withinAvailability, type WeeklySlot } from './scheduling';
import { flagEnabled, getSettings } from './settings';
import { storeFile } from './files';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MIN = 60_000;

// —— الباقات ——

export async function listPlans(tx: Tx, currency: Currency) {
  const rows = await tx
    .select({ plan: plans, price: planPrices })
    .from(plans)
    .innerJoin(planPrices, and(eq(planPrices.planId, plans.id), eq(planPrices.currency, currency), eq(planPrices.active, true)))
    .where(eq(plans.active, true))
    .orderBy(asc(plans.sessionsCount), asc(planPrices.durationMin));
  const byPlan = new Map<string, { code: string; name: string; sessions: number; perWeek: number; rollover: number; validityDays: number; prices: Record<number, number> }>();
  for (const { plan, price } of rows) {
    const p = byPlan.get(plan.id) ?? {
      code: plan.code,
      name: plan.nameAr,
      sessions: plan.sessionsCount,
      perWeek: plan.perWeek,
      rollover: plan.rolloverMax,
      validityDays: plan.validityDays,
      prices: {},
    };
    p.prices[price.durationMin] = price.amount;
    byPlan.set(plan.id, p);
  }
  return { currency, plans: [...byPlan.values()] };
}

// —— الكوبونات ——

type CouponCheck = { userId: string; code: string; planCodes: string[]; currency: Currency; subtotal: number; now?: Date };

export async function checkCoupon(tx: Tx, c: CouponCheck): Promise<{ coupon: typeof coupons.$inferSelect; discount: number }> {
  const now = c.now ?? new Date();
  const [coupon] = await tx.select().from(coupons).where(sql`upper(${coupons.code}) = upper(${c.code.trim()})`);
  const invalid = (msg: string) => new ApiError(422, 'coupon_invalid', msg);
  if (!coupon || !coupon.active) throw invalid('الكوبون غير صالح');
  if (now < coupon.startsAt || now > coupon.endsAt) throw invalid('انتهت صلاحية الكوبون أو لم تبدأ');
  if (coupon.planCodes?.length && !c.planCodes.every((p) => coupon.planCodes!.includes(p))) throw invalid('الكوبون لا يشمل هذه الباقة');
  if (coupon.kind === 'fixed' && coupon.currency !== c.currency) throw invalid('الكوبون بعملة أخرى');
  const [{ total, mine }] = await tx
    .select({
      total: sql<number>`count(*)::int`,
      mine: sql<number>`count(*) filter (where ${couponRedemptions.userId} = ${c.userId})::int`,
    })
    .from(couponRedemptions)
    .innerJoin(orders, eq(orders.id, couponRedemptions.orderId))
    .where(and(eq(couponRedemptions.couponId, coupon.id), inArray(orders.status, ['pending_payment', 'paid'])));
  if (coupon.maxUses !== null && total >= coupon.maxUses) throw invalid('نفدت مرات استخدام الكوبون');
  if (mine >= coupon.maxUsesPerUser) throw invalid('استخدمتِ هذا الكوبون من قبل');
  const after = applyCoupon(c.subtotal, { type: coupon.kind as 'percent' | 'fixed', value: coupon.value });
  return { coupon, discount: Math.round((c.subtotal - after) * 100) / 100 };
}

// —— الطلب ——

export type OrderItemInput = { studentId: string; planCode: string; durationMin: 30 | 45 | 60; teacherId: string; slots: WeeklySlot[] };
export type OrderInput = { items: OrderItemInput[]; method: PaymentMethod; couponCode?: string; onBehalfOf?: string };

async function guardianFor(tx: Tx, userId: string) {
  const [g] = await tx
    .select({ id: guardians.id, userId: guardians.userId, currency: users.currency, timezone: users.timezone })
    .from(guardians)
    .innerJoin(users, eq(users.id, guardians.userId))
    .where(and(eq(guardians.userId, userId), sql`${guardians.deletedAt} is null`));
  return g;
}

export async function createOrder(viewer: Viewer, input: OrderInput, ip?: string | null) {
  const onBehalf = input.onBehalfOf && input.onBehalfOf !== viewer.userId;
  if (onBehalf && !can(viewer.roles, 'plans.purchase.on_behalf')) throw forbidden();
  if (!onBehalf && !can(viewer.roles, 'plans.purchase')) throw forbidden();
  const now = new Date();

  const result = await asSystem(viewer.userId, async (tx) => {
    const g = await guardianFor(tx, onBehalf ? input.onBehalfOf! : viewer.userId);
    if (!g) throw forbidden();
    const currency = g.currency;
    const electronic = await flagEnabled(tx, 'electronic_payment');
    if (!paymentMethodsFor(currency, electronic).includes(input.method) || !PAYMENT_METHODS[input.method].manual) {
      throw new ApiError(422, 'method_unavailable', 'طريقة الدفع غير متاحة لعملتك', { allowed: paymentMethodsFor(currency, electronic) });
    }
    const [account] = await tx
      .select()
      .from(paymentAccounts)
      .where(and(eq(paymentAccounts.method, input.method), eq(paymentAccounts.currency, currency), eq(paymentAccounts.active, true)))
      .orderBy(asc(paymentAccounts.sort))
      .limit(1);
    if (!account) throw new ApiError(422, 'no_account', 'لا يوجد حساب استلام لهذه الطريقة حالياً');

    const cfg = await getSettings(tx, ['payment_hold_hours']);
    const prepared: {
      item: OrderItemInput;
      plan: typeof plans.$inferSelect;
      price: number;
      starts: Date[];
    }[] = [];
    const takenInOrder: { teacherId: string; studentId: string; start: number; end: number }[] = [];

    for (const item of input.items) {
      const [link] = await tx
        .select({ student: students })
        .from(guardianStudents)
        .innerJoin(students, eq(students.id, guardianStudents.studentId))
        .where(and(eq(guardianStudents.guardianId, g.id), eq(guardianStudents.studentId, item.studentId), sql`${students.deletedAt} is null`));
      if (!link) throw forbidden();
      const [plan] = await tx.select().from(plans).where(and(eq(plans.code, item.planCode), eq(plans.active, true)));
      if (!plan) throw notFound('الباقة');
      const [price] = await tx
        .select()
        .from(planPrices)
        .where(and(eq(planPrices.planId, plan.id), eq(planPrices.durationMin, item.durationMin), eq(planPrices.currency, currency), eq(planPrices.active, true)));
      if (!price) throw new ApiError(422, 'no_price', 'هذه المدة غير متاحة بعملتك');
      if (item.slots.length !== plan.perWeek) {
        throw badRequest('slots_count', `اختاري ${plan.perWeek} ${plan.perWeek === 1 ? 'موعد' : 'مواعيد'} في الأسبوع`);
      }
      if (new Set(item.slots.map((s) => s.weekday)).size !== item.slots.length) throw badRequest('slots_same_day', 'اختاري أياماً مختلفة في الأسبوع');

      const starts = planOccurrences(item.slots, g.timezone, plan.sessionsCount, now);
      const horizon = new Date(starts[starts.length - 1].getTime() + DAY);
      const cal = await teacherCalendar(tx, item.teacherId, now, horizon);
      const category = teacherCategory(ageOn(link.student.birthDate, now));
      if (!cal.teacher.categories.includes(category)) throw new ApiError(422, 'teacher_category', 'المعلمة لا تدرّس هذه الفئة');
      for (const at of starts) {
        if (!withinAvailability(cal, at, item.durationMin)) throw conflict('outside_availability', 'أحد المواعيد خارج أوقات إتاحة المعلمة', { startsAt: at });
        const end = at.getTime() + (item.durationMin + cal.buffer) * MIN;
        const clash = takenInOrder.some((t) => (t.teacherId === item.teacherId || t.studentId === item.studentId) && at.getTime() < t.end && t.start < end);
        if (!isFree(cal, at, item.durationMin) || clash) {
          throw conflict('slot_taken', 'أحد المواعيد لم يعد متاحاً لدى المعلمة، اختاري وقتاً آخر', { startsAt: at });
        }
        takenInOrder.push({ teacherId: item.teacherId, studentId: item.studentId, start: at.getTime(), end });
      }
      prepared.push({ item, plan, price: price.amount, starts });
    }

    const subtotal = prepared.reduce((a, p) => a + p.price, 0);
    const coupon = input.couponCode
      ? await checkCoupon(tx, { userId: g.userId, code: input.couponCode, planCodes: prepared.map((p) => p.plan.code), currency, subtotal, now })
      : null;
    const discount = coupon?.discount ?? 0;
    const total = Math.round((subtotal - discount) * 100) / 100;

    const [{ ref }] = (await tx.execute(sql`select app.next_order_ref() as ref`)) as unknown as { ref: string }[];
    const [order] = await tx
      .insert(orders)
      .values({ ref, guardianId: g.id, currency, subtotal, discount, total, couponId: coupon?.coupon.id ?? null, holdExpiresAt: new Date(now.getTime() + cfg.payment_hold_hours * HOUR) })
      .returning();
    for (const p of prepared) {
      const [oi] = await tx
        .insert(orderItems)
        .values({ orderId: order.id, studentId: p.item.studentId, planId: p.plan.id, teacherId: p.item.teacherId, durationMin: p.item.durationMin, unitPrice: p.price })
        .returning();
      await tx.insert(recurringSlots).values(
        p.item.slots.map((s) => ({ orderItemId: oi.id, teacherId: p.item.teacherId, studentId: p.item.studentId, weekday: s.weekday, startTime: s.time, timezone: g.timezone, durationMin: p.item.durationMin })),
      );
      // الحصص محجوزة مؤقتاً: قيد EXCLUDE يمنع غيرها من أخذ الوقت نفسه حتى مع التزامن
      await tx.insert(sessions).values(
        p.starts.map((at) => ({
          orderItemId: oi.id,
          studentId: p.item.studentId,
          teacherId: p.item.teacherId,
          startsAt: at,
          endsAt: new Date(at.getTime() + p.item.durationMin * MIN),
          blockedUntil: new Date(at.getTime() + p.item.durationMin * MIN),
          status: 'held' as const,
        })),
      );
    }
    const [payment] = await tx.insert(payments).values({ orderId: order.id, method: input.method, accountId: account.id, currency, amount: total }).returning();
    if (coupon) await tx.insert(couponRedemptions).values({ couponId: coupon.coupon.id, orderId: order.id, userId: g.userId });
    await audit(tx, viewer, { action: onBehalf ? 'order.create_on_behalf' : 'order.create', entity: 'orders', entityId: order.id, after: { ref, total, currency } }, ip);
    return { order, payment, account, sessions: prepared.reduce((a, p) => a + p.starts.length, 0) };
  });

  // طلب مجاني بالكامل (كوبون 100%) يُعتمد فوراً دون إيصال
  if (result.order.total === 0) await approvePayment(null, result.payment.id, ip);

  return {
    ref: result.order.ref,
    status: result.order.total === 0 ? 'paid' : result.order.status,
    currency: result.order.currency,
    subtotal: result.order.subtotal,
    discount: result.order.discount,
    total: result.order.total,
    holdExpiresAt: result.order.holdExpiresAt,
    sessionsHeld: result.sessions,
    payTo: {
      method: result.account.method,
      title: result.account.titleAr,
      bank: result.account.bankName,
      accountName: result.account.accountName,
      accountNumber: result.account.accountNumber,
      instructions: result.account.instructionsAr,
    },
  };
}

/** الطلب كما يراه صاحبه أو المالية (RLS) */
export async function getOrder(viewer: Viewer, ref: string) {
  return asUser(viewer.userId, async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.ref, ref));
    if (!order) throw notFound('الطلب');
    const items = await tx
      .select({ id: orderItems.id, studentId: orderItems.studentId, student: students.displayName, plan: plans.nameAr, planCode: plans.code, durationMin: orderItems.durationMin, unitPrice: orderItems.unitPrice })
      .from(orderItems)
      .innerJoin(plans, eq(plans.id, orderItems.planId))
      .leftJoin(students, eq(students.id, orderItems.studentId))
      .where(eq(orderItems.orderId, order.id));
    const pays = await tx.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.createdAt));
    const receipts = pays.length
      ? await tx.select().from(paymentReceipts).where(inArray(paymentReceipts.paymentId, pays.map((p) => p.id))).orderBy(desc(paymentReceipts.createdAt))
      : [];
    const [account] = pays[0]?.accountId ? await tx.select().from(paymentAccounts).where(eq(paymentAccounts.id, pays[0].accountId)) : [];
    return {
      ref: order.ref,
      status: order.status,
      currency: order.currency,
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      holdExpiresAt: order.holdExpiresAt,
      createdAt: order.createdAt,
      items,
      payment: pays[0] ? { id: pays[0].id, status: pays[0].status, method: pays[0].method, reason: pays[0].reason, reviewedAt: pays[0].reviewedAt } : null,
      receipts: receipts.map((r) => ({ id: r.id, fileId: r.fileId, senderName: r.senderName, transferDate: r.transferDate, createdAt: r.createdAt })),
      payTo: account
        ? { method: account.method, title: account.titleAr, bank: account.bankName, accountName: account.accountName, accountNumber: account.accountNumber, instructions: account.instructionsAr }
        : null,
    };
  });
}

// —— الإيصال ——

export async function submitReceipt(viewer: Viewer, ref: string, input: { bytes: Uint8Array; senderName: string; transferDate: string }, ip?: string | null) {
  const owned = await asUser(viewer.userId, async (tx) => (await tx.select({ id: orders.id }).from(orders).where(eq(orders.ref, ref)))[0]);
  if (!owned) throw notFound('الطلب');
  return asSystem(viewer.userId, async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, owned.id)).for('update');
    if (order.status !== 'pending_payment') throw conflict('order_closed', 'الطلب لم يعد بانتظار الدفع');
    const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.createdAt)).limit(1).for('update');
    if (!payment || !canTransition(payment.status as PaymentStatus, 'under_review')) throw conflict('receipt_not_expected', 'لا يمكن رفع إيصال لهذا الطلب الآن');
    if (new Date(`${input.transferDate}T00:00:00Z`).getTime() > Date.now() + DAY) throw badRequest('transfer_date', 'تاريخ التحويل في المستقبل');
    const file = await storeFile(tx, { ownerId: viewer.userId, kind: 'receipt', bytes: input.bytes });
    await tx.insert(paymentReceipts).values({ paymentId: payment.id, fileId: file.id, senderName: input.senderName, transferDate: input.transferDate, uploadedBy: viewer.userId });
    await tx.update(payments).set({ status: 'under_review', reason: null }).where(eq(payments.id, payment.id));
    const finance = await tx.execute(sql`select user_id from user_roles where role in ('finance', 'super_admin')`);
    await notify(tx, {
      userIds: (finance as unknown as { user_id: string }[]).map((r) => r.user_id),
      event: 'payment_submitted',
      vars: { ref: order.ref, amount: `${order.total} ${order.currency}` },
      data: { paymentId: payment.id, ref: order.ref },
    });
    await audit(tx, viewer, { action: 'payment.receipt', entity: 'payments', entityId: payment.id, before: { status: payment.status }, after: { status: 'under_review', fileId: file.id } }, ip);
    return { ref: order.ref, paymentStatus: 'under_review' as const };
  });
}

// —— مراجعة المالية ——

export async function paymentsQueue(viewer: Viewer, status: PaymentStatus = 'under_review') {
  return asUser(viewer.userId, async (tx) => {
    const rows = await tx
      .select({
        id: payments.id,
        status: payments.status,
        method: payments.method,
        currency: payments.currency,
        amount: payments.amount,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
        ref: orders.ref,
        holdExpiresAt: orders.holdExpiresAt,
        guardianName: users.fullName,
        guardianPhone: users.phone,
        country: users.country,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .innerJoin(guardians, eq(guardians.id, orders.guardianId))
      .innerJoin(users, eq(users.id, guardians.userId))
      .where(eq(payments.status, status))
      .orderBy(asc(payments.updatedAt));
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const receipts = await tx.select().from(paymentReceipts).where(inArray(paymentReceipts.paymentId, ids)).orderBy(desc(paymentReceipts.createdAt));
    const names = await tx
      .select({ paymentId: payments.id, name: sql<string | null>`app.student_name(${orderItems.studentId})` })
      .from(payments)
      .innerJoin(orderItems, eq(orderItems.orderId, payments.orderId))
      .where(inArray(payments.id, ids));
    return rows.map((r) => ({
      ...r,
      students: names.filter((n) => n.paymentId === r.id).map((n) => n.name ?? '—'),
      receipt: receipts.find((x) => x.paymentId === r.id) ?? null,
    }));
  });
}

async function lockPayment(tx: Tx, paymentId: string) {
  const [payment] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
  if (!payment) throw notFound('الدفعة');
  const [order] = await tx.select().from(orders).where(eq(orders.id, payment.orderId)).for('update');
  return { payment, order };
}

async function familyOf(tx: Tx, orderId: string) {
  const rows = await tx
    .select({ userId: guardians.userId })
    .from(orders)
    .innerJoin(guardians, eq(guardians.id, orders.guardianId))
    .where(eq(orders.id, orderId));
  return rows.map((r) => r.userId);
}

/** اعتماد التحويل: الاشتراك والحصص والروابط والإشعار في معاملة واحدة */
export async function approvePayment(viewer: Viewer | null, paymentId: string, ip?: string | null) {
  if (viewer && !can(viewer.roles, 'payments.approve')) throw forbidden();
  return asSystem(viewer?.userId ?? null, async (tx) => {
    const { payment, order } = await lockPayment(tx, paymentId);
    const free = order.total === 0 && payment.status === 'awaiting_transfer' && !viewer;
    if (!free && !canTransition(payment.status as PaymentStatus, 'approved')) throw conflict('not_approvable', 'لا يمكن اعتماد هذه الدفعة بحالتها الحالية');
    if (order.status !== 'pending_payment') throw conflict('order_closed', 'الطلب منتهٍ أو ملغى');
    const now = new Date();
    await tx.update(payments).set({ status: 'approved', reviewedBy: viewer?.userId ?? null, reviewedAt: now, reason: null }).where(eq(payments.id, payment.id));
    await tx.update(orders).set({ status: 'paid' }).where(eq(orders.id, order.id));

    const items = await tx.select({ item: orderItems, plan: plans }).from(orderItems).innerJoin(plans, eq(plans.id, orderItems.planId)).where(eq(orderItems.orderId, order.id));
    const scheduledIds: string[] = [];
    const studentNames: string[] = [];
    for (const { item, plan } of items) {
      const held = await tx.select().from(sessions).where(and(eq(sessions.orderItemId, item.id), eq(sessions.status, 'held'))).orderBy(asc(sessions.startsAt));
      const last = held[held.length - 1]?.endsAt ?? now;
      // ترحيل ما لم يُجدول من الباقة السابقة حتى الحد المسموح في الباقة الجديدة
      const [prev] = await tx
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.studentId, item.studentId), eq(subscriptions.status, 'active')))
        .orderBy(desc(subscriptions.expiresAt))
        .limit(1);
      let carry = 0;
      if (prev) {
        const [{ upcoming }] = await tx
          .select({ upcoming: sql<number>`count(*)::int` })
          .from(sessions)
          .where(and(eq(sessions.subscriptionId, prev.id), inArray(sessions.status, ['held', 'scheduled']), eq(sessions.isMakeup, false)));
        carry = Math.max(0, Math.min(prev.sessionsRemaining - upcoming, plan.rolloverMax));
        if (carry) await tx.update(subscriptions).set({ sessionsRemaining: prev.sessionsRemaining - carry }).where(eq(subscriptions.id, prev.id));
      }
      const [sub] = await tx
        .insert(subscriptions)
        .values({
          orderItemId: item.id,
          studentId: item.studentId,
          planId: plan.id,
          durationMin: item.durationMin,
          sessionsTotal: plan.sessionsCount,
          sessionsRemaining: plan.sessionsCount + carry,
          rolledOver: carry,
          startsAt: now,
          expiresAt: new Date(Math.max(now.getTime() + plan.validityDays * DAY, last.getTime() + DAY)),
        })
        .returning();
      if (held.length) {
        await tx.update(sessions).set({ status: 'scheduled', subscriptionId: sub.id }).where(inArray(sessions.id, held.map((h) => h.id)));
        scheduledIds.push(...held.map((h) => h.id));
      }
      const [st] = await tx.select().from(students).where(eq(students.id, item.studentId));
      if (st.teacherId !== item.teacherId) await tx.update(students).set({ teacherId: item.teacherId }).where(eq(students.id, st.id));
      studentNames.push(st.displayName);
    }
    await requestMeetings(tx, scheduledIds);
    await notify(tx, { userIds: await familyOf(tx, order.id), event: 'payment_approved', vars: { student: studentNames.join(' و') }, data: { ref: order.ref } });
    await audit(tx, viewer, { action: 'payment.approve', entity: 'payments', entityId: payment.id, before: { status: payment.status }, after: { status: 'approved', sessions: scheduledIds.length } }, ip);
    return { ref: order.ref, status: 'approved' as const, sessionsScheduled: scheduledIds.length };
  });
}

async function releaseHeld(tx: Tx, orderId: string, reason: string) {
  const items = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId));
  if (!items.length) return 0;
  const freed = await tx
    .update(sessions)
    .set({ status: 'cancelled', cancelReason: reason })
    .where(and(inArray(sessions.orderItemId, items.map((i) => i.id)), eq(sessions.status, 'held')))
    .returning({ id: sessions.id });
  await tx.update(recurringSlots).set({ active: false }).where(inArray(recurringSlots.orderItemId, items.map((i) => i.id)));
  return freed.length;
}

export async function rejectPayment(viewer: Viewer, paymentId: string, input: { reason: string; needsFix: boolean }, ip?: string | null) {
  if (!can(viewer.roles, 'payments.approve')) throw forbidden();
  const to: PaymentStatus = input.needsFix ? 'needs_fix' : 'rejected';
  return asSystem(viewer.userId, async (tx) => {
    const { payment, order } = await lockPayment(tx, paymentId);
    if (!canTransition(payment.status as PaymentStatus, to)) throw conflict('not_reviewable', 'لا يمكن تغيير هذه الدفعة بحالتها الحالية');
    await tx.update(payments).set({ status: to, reason: input.reason, reviewedBy: viewer.userId, reviewedAt: new Date() }).where(eq(payments.id, payment.id));
    if (to === 'rejected') {
      await tx.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, order.id));
      await releaseHeld(tx, order.id, 'رُفض التحويل');
    } else {
      // مهلة إضافية يوماً على الأقل لتصحيح الإيصال دون خسارة المواعيد المحجوزة
      const extended = new Date(Math.max(order.holdExpiresAt.getTime(), Date.now() + DAY));
      await tx.update(orders).set({ holdExpiresAt: extended }).where(eq(orders.id, order.id));
    }
    await notify(tx, { userIds: await familyOf(tx, order.id), event: 'payment_rejected', vars: { ref: order.ref, reason: input.reason }, data: { ref: order.ref, status: to } });
    await audit(tx, viewer, { action: `payment.${to}`, entity: 'payments', entityId: payment.id, before: { status: payment.status }, after: { status: to }, reason: input.reason }, ip);
    return { ref: order.ref, status: to };
  });
}

export async function createRefund(viewer: Viewer, input: { paymentId: string; amount: number; reason: string }, ip?: string | null) {
  if (!can(viewer.roles, 'payments.refund')) throw forbidden();
  return asSystem(viewer.userId, async (tx) => {
    const { payment } = await lockPayment(tx, input.paymentId);
    if (payment.status !== 'approved') throw conflict('not_refundable', 'الاسترداد لدفعة معتمدة فقط');
    const [{ done }] = await tx.select({ done: sum(refunds.amount).mapWith(Number) }).from(refunds).where(eq(refunds.paymentId, payment.id));
    if ((done ?? 0) + input.amount > payment.amount) throw new ApiError(422, 'refund_exceeds', 'مبلغ الاسترداد أكبر من المتبقي', { refundable: payment.amount - (done ?? 0) });
    const [row] = await tx.insert(refunds).values({ paymentId: payment.id, amount: input.amount, currency: payment.currency, reason: input.reason, createdBy: viewer.userId }).returning();
    await audit(tx, viewer, { action: 'payment.refund', entity: 'refunds', entityId: row.id, after: row, reason: input.reason }, ip);
    return row;
  });
}

// —— مهام العامل ——

/** الطلبات غير المدفوعة بعد المهلة تُلغى وتتحرّر أوقاتها (القسم 6) */
export async function expireOrders(tx: Tx, now = new Date()) {
  const due = await tx
    .select({ order: orders, payment: payments })
    .from(orders)
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .where(and(eq(orders.status, 'pending_payment'), lt(orders.holdExpiresAt, now), inArray(payments.status, ['awaiting_transfer', 'needs_fix'])))
    .for('update', { of: orders, skipLocked: true });
  for (const { order, payment } of due) {
    await tx.update(orders).set({ status: 'expired' }).where(eq(orders.id, order.id));
    await tx.update(payments).set({ status: 'expired' }).where(eq(payments.id, payment.id));
    await releaseHeld(tx, order.id, 'انتهت مهلة الدفع');
    await audit(tx, null, { action: 'order.expire', entity: 'orders', entityId: order.id, before: { status: order.status }, after: { status: 'expired' } });
  }
  return due.length;
}

export async function expireSubscriptions(tx: Tx, now = new Date()) {
  const rows = await tx
    .update(subscriptions)
    .set({ status: 'expired' })
    .where(and(eq(subscriptions.status, 'active'), lt(subscriptions.expiresAt, now)))
    .returning({ id: subscriptions.id });
  return rows.length;
}

/** للمالية: الدفعة وإيصالاتها كاملة (للتحقق قبل الاعتماد) */
export async function paymentDetail(viewer: Viewer, paymentId: string) {
  return asUser(viewer.userId, async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId));
    if (!p) throw notFound('الدفعة');
    const receipts = await tx
      .select({ id: paymentReceipts.id, senderName: paymentReceipts.senderName, transferDate: paymentReceipts.transferDate, createdAt: paymentReceipts.createdAt, fileId: files.id, mime: files.mime })
      .from(paymentReceipts)
      .innerJoin(files, eq(files.id, paymentReceipts.fileId))
      .where(eq(paymentReceipts.paymentId, p.id))
      .orderBy(desc(paymentReceipts.createdAt));
    const refundRows = await tx.select().from(refunds).where(eq(refunds.paymentId, p.id));
    return { ...p, receipts, refunds: refundRows };
  });
}

