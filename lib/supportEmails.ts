import { createAdminClient } from '@/lib/supabase/admin';
import { lessonEmailConfig, escapeEmailHtml } from '@/lib/lessonEmails';
import { cleanEmail } from '@/lib/security';
import { EMAIL_LOGO_V1 } from '@/lib/emailLogoV1';

type SupportNotice = { id: string; name: string; subject: string };
export function supportEmailMessage(notice: SupportNotice, platformUrl: string) {
  const url = new URL(platformUrl).origin;
  const text = `طلب دعم جديد من ${notice.name}\nالموضوع: ${notice.subject}`;
  return {
    subject: 'طلب دعم جديد — Djawed Logic',
    text: text + '\n\n' + url,
    html: `<div dir="rtl" lang="ar" style="font-family:Arial,sans-serif;line-height:1.8;color:#172033"><h2>طلب دعم جديد</h2><p>من: ${escapeEmailHtml(notice.name)}</p><p>الموضوع: ${escapeEmailHtml(notice.subject)}</p><p><img src="cid:djawed-logic-logo-v1" alt="Djawed Logic" width="84" height="96" style="display:block;max-width:100%;height:auto;border:0"></p><p><a href="${escapeEmailHtml(url)}" dir="ltr">فتح المنصة لعرض الطلب</a></p></div>`,
    attachments: [{ filename: 'djawed-logic-logo.png', content: EMAIL_LOGO_V1, content_type: 'image/png', content_id: 'djawed-logic-logo-v1' }],
  };
}
export async function sendOwnerEmail(idempotencyKey: string, message: (platformUrl: string) => ReturnType<typeof supportEmailMessage>) {
  const config = lessonEmailConfig();
  if (!config) throw new Error('Support email configuration unavailable');
  let recipient: string | null = null;
  if (process.env.SUPPORT_NOTIFICATION_EMAIL !== undefined) {
    recipient = cleanEmail(process.env.SUPPORT_NOTIFICATION_EMAIL);
    if (!recipient) throw new Error('Invalid support notification recipient');
  } else {
    const db = createAdminClient();
    // Never select an arbitrary recipient or notify all admins when the owner
    // requested notifications only for themselves.
    const { data: admins, error } = await db.from('profiles').select('id').eq('is_admin', true).limit(2);
    if (error || admins?.length !== 1) throw new Error('Set SUPPORT_NOTIFICATION_EMAIL to resolve the owner');
    const { data, error: authError } = await db.auth.admin.getUserById(admins[0].id);
    if (authError) throw new Error('Support recipient lookup failed');
    recipient = cleanEmail(data.user?.email);
    if (!recipient) throw new Error('Support recipient has no email');
  }
  const body = JSON.stringify({ from: config.from, to: [recipient], ...message(config.url) });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body, signal: AbortSignal.timeout(8_000),
      });
      if (response.ok) return;
      if (response.status !== 429 && response.status < 500) throw new Error('Permanent support email rejection');
    } catch (error) {
      if (error instanceof Error && error.message === 'Permanent support email rejection') throw error;
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
  }
  throw new Error('Support email delivery failed after retries');
}

export async function notifySupportRequest(notice: SupportNotice) {
  return sendOwnerEmail(`support-email/v1/${notice.id}`, url => supportEmailMessage(notice, url));
}
