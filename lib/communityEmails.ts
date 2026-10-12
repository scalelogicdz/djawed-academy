import { createAdminClient } from '@/lib/supabase/admin';
import { EMAIL_LOGO_V1 } from '@/lib/emailLogoV1';
import { lessonEmailConfig, escapeEmailHtml } from '@/lib/lessonEmails';

export function communityEmailMessage(type: 'admin_post' | 'admin_reply', platformUrl: string) {
  const url = new URL(platformUrl).origin;
  const text = type === 'admin_post' ? 'نشر جواد منشورًا جديدًا في المجتمع.' : 'ردّ جواد على تعليقك في المجتمع.';
  return {
    subject: type === 'admin_post' ? 'منشور جديد من جواد — Djawed Logic' : 'ردّ جديد من جواد — Djawed Logic',
    text: `${text}\n\n${url}`,
    html: `<div dir="rtl" lang="ar" style="font-family:Arial,sans-serif;line-height:1.8;color:#172033"><p>${text}</p><p><img src="cid:djawed-logic-logo-v1" alt="Djawed Logic" width="84" height="96" style="display:block;max-width:100%;height:auto;border:0"></p><p><a href="${escapeEmailHtml(url)}" dir="ltr" style="font-size:16px;color:#1877f2;text-decoration:underline">${escapeEmailHtml(url)}</a></p></div>`,
    attachments: [{ filename: 'djawed-logic-logo.png', content: EMAIL_LOGO_V1, content_type: 'image/png', content_id: 'djawed-logic-logo-v1' }],
  };
}

export async function dispatchCommunityEmails() {
  const config = lessonEmailConfig();
  if (!config) return;
  const db = createAdminClient();
  const deadline = Date.now() + 35_000;
  while (Date.now() < deadline) {
    const { data, error } = await db.rpc('claim_community_email', { email_from: config.from, platform_url: config.url });
    if (error) throw new Error('Community email queue unavailable');
    const job = data?.[0];
    if (!job) break;
    try {
      if (!['admin_post', 'admin_reply'].includes(job.payload?.type)) throw new Error('Invalid queued event');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `community-email/v1/${job.id}` },
        body: JSON.stringify({ from: job.payload.from, to: [job.recipient], ...communityEmailMessage(job.payload.type, job.payload.url) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Email provider rejected delivery');
      const { error: saveError } = await db.from('community_email_jobs').update({ status: 'sent', sent_at: new Date().toISOString(), locked_until: null }).eq('id', job.id);
      if (saveError) throw new Error('Could not record delivery');
    } catch {
      await db.from('community_email_jobs').update({ status: 'failed', locked_until: null, next_attempt_at: new Date(Date.now() + 60_000).toISOString() }).eq('id', job.id);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
}
