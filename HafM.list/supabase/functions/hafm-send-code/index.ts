// HafM.list — e-mails a 6-digit sign-up / PIN-reset code to a @halfm.sa work address.
// Deployed to Supabase project "fazat-dam" as Edge Function "hafm-send-code" (verify_jwt: false).
// Public endpoint (the app has no Supabase Auth JWT): the database function hafm_issue_code
// checks the domain and rate-limits (1 code per minute, 5 per hour per e-mail).
// Secrets: RESEND_API_KEY (required), HAFM_MAIL_FROM (optional, default "HafM.list <no-reply@albushra.app>").
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let email = "";
  let lang = "ar";
  try {
    const b = await req.json();
    email = String(b.email || "").trim().toLowerCase();
    lang = b.lang === "en" ? "en" : "ar";
  } catch { return json({ error: "bad_request" }, 400); }
  if (!/^[^\s@]+@halfm\.sa$/.test(email)) return json({ error: "email_domain" }, 400);

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ error: "email_not_configured" }, 503);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: code, error } = await db.rpc("hafm_issue_code", { p_email: email });
  if (error) {
    const m = String(error.message || "");
    const code2 = m.startsWith("hafm:") ? m.slice(5) : "server";
    return json({ error: code2 }, code2 === "too_soon" || code2 === "too_many" ? 429 : 400);
  }

  const subject = lang === "en" ? `HafM.list verification code: ${code}` : `رمز التحقق لقوائم الجودة: ${code}`;
  const html = `<!doctype html><html dir="${lang === "en" ? "ltr" : "rtl"}"><body style="margin:0;background:#f5ede3;font-family:Tahoma,Arial,sans-serif;color:#141210">
<div style="max-width:460px;margin:0 auto;padding:28px 20px">
<div style="background:#fff;border-radius:22px;padding:26px;text-align:center">
<div style="font-size:30px;font-weight:800;letter-spacing:1px">½<span style="color:#5aa38d">✓</span>M</div>
<div style="width:46px;height:6px;background:#d4b38b;margin:10px auto 18px"></div>
<p style="font-size:16px;margin:0 0 8px">${lang === "en" ? "Your HafM.list verification code" : "رمز التحقق لتطبيق قوائم الجودة"}</p>
<div style="font-size:36px;font-weight:800;letter-spacing:10px;background:#e3f2ec;color:#2f7a65;border-radius:16px;padding:14px 0;margin:14px 0;direction:ltr">${code}</div>
<p style="font-size:13px;color:#7a7066;margin:0">${lang === "en" ? "Valid for 10 minutes. If you did not request it, ignore this e-mail." : "صالح لمدة 10 دقائق. إن لم تطلبه فتجاهل هذه الرسالة."}</p>
</div><p style="text-align:center;font-size:12px;color:#7a7066">HafM.list · 1/2 Million Quality list</p></div></body></html>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("HAFM_MAIL_FROM") || "HafM.list <no-reply@albushra.app>",
      to: [email], subject, html,
      text: `${subject}\n${lang === "en" ? "Valid for 10 minutes." : "صالح لمدة 10 دقائق."}`,
    }),
  });
  if (!r.ok) { console.error("resend", r.status, await r.text()); return json({ error: "send_failed" }, 502); }
  return json({ ok: true });
});
