import { sendOwnerEmail } from '@/lib/supportEmails';
import { escapeEmailHtml } from '@/lib/lessonEmails';
import { EMAIL_LOGO_V1 } from '@/lib/emailLogoV1';

export function ownerCommunityEmailMessage(type: 'question' | 'reply', platformUrl: string) {
  const url = new URL(platformUrl).origin;
  const text = type === 'question'
    ? 'نشر أحد المشتركين منشورًا جديدًا في المجتمع.'
    : 'أضاف أحد المشتركين ردًا جديدًا في المجتمع.';
  return {
    subject: type === 'question' ? 'منشور جديد في المجتمع — Djawed Logic' : 'رد جديد في المجتمع — Djawed Logic',
    text: `${text}\n\n${url}`,
    html: `<div dir="rtl" lang="ar" style="font-family:Arial,sans-serif;line-height:1.8;color:#172033"><p>${text}</p><p><img src="cid:djawed-logic-logo-v1" alt="Djawed Logic" width="84" height="96" style="display:block;max-width:100%;height:auto;border:0"></p><p><a href="${escapeEmailHtml(url)}" dir="ltr">${escapeEmailHtml(url)}</a></p></div>`,
    attachments: [{ filename: 'djawed-logic-logo.png', content: EMAIL_LOGO_V1, content_type: 'image/png', content_id: 'djawed-logic-logo-v1' }],
  };
}

export async function notifyOwnerCommunityActivity(type: 'question' | 'reply', id: string) {
  return sendOwnerEmail(`owner-community-email/v1/${type}/${id}`, url => ownerCommunityEmailMessage(type, url));
}
