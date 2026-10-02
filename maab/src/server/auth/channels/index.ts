// قنوات إرسال الرسائل: واتساب أولاً للجميع، والرسالة النصية احتياطاً للأرقام
// السعودية، والبريد احتياطاً لغيرها. في التطوير يكتب السائق «console» الرسالة
// في سجل الخادم وفي صندوق التطوير (/dev/outbox) بدل إرسالها.
import nodemailer, { type Transporter } from 'nodemailer';
import type { OtpChannel } from '@/lib/domain/market';
import { env } from '../../env';

export type OutboxItem = { channel: OtpChannel; to: string; text: string; at: string };

const globalOutbox = globalThis as unknown as { maabOutbox?: OutboxItem[] };

/** آخر 50 رسالة أُرسلت بسائق التطوير */
export function devOutbox(): OutboxItem[] {
  return (globalOutbox.maabOutbox ??= []);
}

function toConsole(channel: OtpChannel, to: string, text: string) {
  const box = devOutbox();
  box.unshift({ channel, to, text, at: new Date().toISOString() });
  box.length = Math.min(box.length, 50);
  console.info(`[outbox:${channel}] ${to} ← ${text}`);
}

export class ChannelError extends Error {
  constructor(
    public channel: OtpChannel,
    message: string,
  ) {
    super(message);
  }
}

/** واتساب Business Cloud API بقالب رمز تحقق معتمد مسبقاً (authentication template) */
async function whatsappMeta(to: string, code: string) {
  const e = env();
  if (!e.WHATSAPP_TOKEN || !e.WHATSAPP_PHONE_ID) throw new ChannelError('whatsapp', 'WhatsApp غير مهيّأ');
  const res = await fetch(`https://graph.facebook.com/v21.0/${e.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace('+', ''),
      type: 'template',
      template: {
        name: e.WHATSAPP_TEMPLATE,
        language: { code: 'ar' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    }),
  });
  if (!res.ok) throw new ChannelError('whatsapp', `WhatsApp ${res.status}: ${await res.text()}`);
}

/** Unifonic — مزوّد سعودي باسم مرسل مسجّل */
async function smsUnifonic(to: string, text: string) {
  const e = env();
  if (!e.UNIFONIC_APP_SID) throw new ChannelError('sms', 'SMS غير مهيّأ');
  const body = new URLSearchParams({ AppSid: e.UNIFONIC_APP_SID, SenderID: e.UNIFONIC_SENDER, Recipient: to.replace('+', ''), Body: text });
  const res = await fetch('https://el.cloud.unifonic.com/rest/SMS/messages', { method: 'POST', body });
  if (!res.ok) throw new ChannelError('sms', `Unifonic ${res.status}`);
}

let transporter: Transporter | undefined;

async function emailSmtp(to: string, subject: string, text: string) {
  const e = env();
  if (!e.SMTP_URL) throw new ChannelError('email', 'SMTP غير مهيّأ');
  transporter ??= nodemailer.createTransport(e.SMTP_URL);
  await transporter.sendMail({ from: e.EMAIL_FROM, to, subject, text });
}

/** يرسل رمز الدخول عبر القناة المطلوبة */
export async function deliverOtp(channel: OtpChannel, to: string, code: string): Promise<void> {
  const text = `رمز دخولك إلى مآب: ${code}\nصالح 5 دقائق، ولا تشاركيه مع أحد.`;
  const e = env();
  if (channel === 'whatsapp') return e.WHATSAPP_DRIVER === 'meta' ? whatsappMeta(to, code) : toConsole(channel, to, text);
  if (channel === 'sms') return e.SMS_DRIVER === 'unifonic' ? smsUnifonic(to, text) : toConsole(channel, to, text);
  return e.EMAIL_DRIVER === 'smtp' ? emailSmtp(to, 'رمز الدخول إلى مآب', text) : toConsole(channel, to, text);
}

/** رسالة إشعار عامة عبر القناة نفسها (تذكير، تقرير، اعتماد…) */
export async function deliverMessage(channel: OtpChannel, to: string, title: string, body: string): Promise<void> {
  const e = env();
  const text = `${title}\n${body}`;
  if (channel === 'email') return e.EMAIL_DRIVER === 'smtp' ? emailSmtp(to, title, body) : toConsole(channel, to, text);
  if (channel === 'sms') return e.SMS_DRIVER === 'unifonic' ? smsUnifonic(to, text) : toConsole(channel, to, text);
  // إشعارات واتساب العامة بقوالب معتمدة في المرحلة الثانية (feature flag: whatsapp)
  return toConsole(channel, to, text);
}
