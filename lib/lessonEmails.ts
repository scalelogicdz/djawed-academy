import { createAdminClient } from '@/lib/supabase/admin';

export function lessonEmailConfig() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const rawUrl = process.env.PLATFORM_URL;
  if (!key || !from || !rawUrl || /[\r\n]/.test(from)) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return { key, from, url: url.origin };
  } catch { return null; }
}

export async function lessonEmailsReady() {
  if (!lessonEmailConfig()) return false;
  const { error } = await createAdminClient().from('lesson_email_jobs').select('id').limit(1);
  return !error;
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}

function legacyLessonEmailMessage(title: string, url: string) {
  return {
    subject: `درس جديد في Djawed Logic: ${title}`,
    text: `أضفنا درسًا جديدًا إلى دورتك: ${title}\n\nشاهد الدرس على منصتك:\n${url}\n\nفريق Djawed Logic`,
    html: `<div dir="rtl" lang="ar" style="font-family:Arial,sans-serif;line-height:1.8;color:#172033"><h2>درس جديد على منصتك</h2><p>أضفنا درسًا جديدًا إلى دورتك:</p><h3>${escapeEmailHtml(title)}</h3><p><a href="${escapeEmailHtml(url)}" style="display:inline-block;background:#1877f2;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">شاهد الدرس</a></p><p>فريق Djawed Logic</p></div>`,
  };
}

// Keep the old payload for retries of emails attempted before this template
// change; the provider requires an unchanged body with the same idempotency key.
const PLATFORM_EMAIL_CUTOVER = '2026-10-06T14:51:11Z';

function imageLessonEmailMessage(title: string, lessonUrl: string) {
  const platformUrl = new URL(lessonUrl).origin;
  const imageUrl = `${platformUrl}/djawed-logic-logo.png`;
  return {
    subject: `درس جديد في Djawed Logic: ${title}`,
    text: platformUrl,
    html: `<div dir="rtl" lang="ar" style="font-family:Arial,sans-serif;text-align:center;padding:24px"><img src="${escapeEmailHtml(imageUrl)}" alt="Djawed Logic" width="126" height="144" style="display:block;margin:0 auto 20px;max-width:100%;height:auto;border:0"><a href="${escapeEmailHtml(platformUrl)}" dir="ltr" style="font-size:16px;color:#1877f2;text-decoration:underline">${escapeEmailHtml(platformUrl)}</a></div>`,
  };
}

const TEXT_EMAIL_CUTOVER = '2026-10-06T15:20:34Z';

export function lessonEmailMessage(title: string, lessonUrl: string) {
  const platformUrl = new URL(lessonUrl).origin;
  return {
    subject: `درس جديد في Djawed Logic: ${title}`,
    text: `درس جديد على منصتك\n\nأضفنا درسًا جديدًا إلى دورتك:\n${title}\n\n${platformUrl}`,
    html: `<div dir="rtl" lang="ar" style="font-family:Arial,sans-serif;line-height:1.8;color:#172033"><h2>درس جديد على منصتك</h2><p>أضفنا درسًا جديدًا إلى دورتك:</p><h3>${escapeEmailHtml(title)}</h3><p><a href="${escapeEmailHtml(platformUrl)}" dir="ltr" style="font-size:16px;color:#1877f2;text-decoration:underline">${escapeEmailHtml(platformUrl)}</a></p></div>`,
  };
}

export async function lessonEmailStats() {
  const db = createAdminClient();
  const counts = await Promise.all(['pending', 'sending', 'sent', 'failed', 'held'].map(async (status) => {
    const { count, error } = await db.from('lesson_email_jobs').select('id', { count: 'exact', head: true }).eq('status', status);
    if (error) throw new Error('Email queue unavailable');
    return [status, count ?? 0] as const;
  }));
  return Object.fromEntries(counts) as Record<string, number>;
}

// Each recipient gets a private message. Database leases and stable provider keys
// protect retries, including a crash after Resend accepts the message.
export async function dispatchLessonEmails() {
  const config = lessonEmailConfig();
  if (!config) return;
  const db = createAdminClient();
  const deadline = Date.now() + 35_000;
  while (Date.now() < deadline) {
    const { data, error } = await db.rpc('claim_lesson_email');
    if (error) throw new Error('Could not claim email');
    const job = data?.[0];
    if (!job) break;
    try {
      // Do not notify a student whose course access was removed after publication.
      const { data: lesson } = await db.from('lessons').select('module_id').eq('id', job.lesson_id).single();
      const { data: module } = await db.from('modules').select('course_id').eq('id', lesson?.module_id).single();
      const { data: enrollment, error: enrollmentError } = await db.from('enrollments').select('id').eq('student_id', job.student_id).eq('course_id', module?.course_id).maybeSingle();
      if (enrollmentError) throw new Error('Enrollment lookup failed');
      if (!enrollment) {
        await db.from('lesson_email_jobs').update({ status: 'held', locked_until: null }).eq('id', job.id);
        continue;
      }
      const message = job.first_attempt_at && job.first_attempt_at < PLATFORM_EMAIL_CUTOVER
        ? legacyLessonEmailMessage(job.payload.title, job.payload.url)
        : job.first_attempt_at && job.first_attempt_at < TEXT_EMAIL_CUTOVER
          ? imageLessonEmailMessage(job.payload.title, job.payload.url)
          : lessonEmailMessage(job.payload.title, job.payload.url);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `lesson-email/${job.id}` },
        body: JSON.stringify({ from: job.payload.from, to: [job.recipient], ...message }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error('Email provider did not accept message');
      const { error: saveError } = await db.from('lesson_email_jobs').update({ status: 'sent', sent_at: new Date().toISOString(), locked_until: null }).eq('id', job.id);
      if (saveError) throw new Error('Could not record email delivery');
    } catch {
      // Keep the original payload and key for safe retry; pause on provider errors.
      await db.from('lesson_email_jobs').update({ status: 'failed', locked_until: null }).eq('id', job.id);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 650));
  }
}
