import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/security';
import { dispatchLessonEmails, lessonEmailsReady, lessonEmailStats } from '@/lib/lessonEmails';

export const maxDuration = 60;
async function allowed() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.from('profiles').select('is_admin').eq('id', user.id).single();
  return data?.is_admin ? user : null;
}
export async function GET() {
  if (!(await allowed())) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  if (!(await lessonEmailsReady())) return NextResponse.json({ error: 'البريد غير مفعّل' }, { status: 503 });
  return NextResponse.json(await lessonEmailStats());
}
export async function POST(request: Request) {
  // An optional scheduler can drain large queues even when the admin is offline.
  const secret = process.env.LESSON_EMAIL_WORKER_SECRET;
  const scheduler = !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
  if (!scheduler) {
    const user = await allowed();
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    if (!checkRateLimit(`lesson-emails:${user.id}`, 4, 60_000).allowed) return NextResponse.json({ error: 'حاول بعد قليل' }, { status: 429 });
  }
  if (!(await lessonEmailsReady())) return NextResponse.json({ error: 'البريد غير مفعّل' }, { status: 503 });
  after(async () => {
    try { await dispatchLessonEmails(); } catch { console.error('Lesson email queue requires retry'); }
  });
  return NextResponse.json({ queued: true });
}
