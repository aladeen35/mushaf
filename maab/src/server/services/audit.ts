// سجل التدقيق (القسم 15): من، ماذا، على أي سجل، القيمة قبل وبعد، الوقت والعنوان.
// غير قابل للتعديل (مشغّل في القاعدة) ويُكتب داخل معاملة الإجراء نفسها.
import type { Tx } from '../db/client';
import { auditLogs } from '../db/schema';
import type { Viewer } from '../api/route';

export type AuditEntry = {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

export async function audit(tx: Tx, actor: Pick<Viewer, 'userId' | 'roles' | 'impersonatedBy'> | null, e: AuditEntry, ip?: string | null) {
  await tx.insert(auditLogs).values({
    // عند الدخول بحساب مستخدم يُنسب الإجراء لموظف الدعم ويُذكر المستخدم المنتحَل
    actorId: actor ? (actor.impersonatedBy ?? actor.userId) : null,
    actorRole: actor ? (actor.impersonatedBy ? 'support' : (actor.roles[0] ?? null)) : 'system',
    impersonatedUserId: actor?.impersonatedBy ? actor.userId : null,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId ?? null,
    before: e.before ?? null,
    after: e.after ?? null,
    reason: e.reason ?? null,
    ip: ip ?? null,
  });
}
