import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/security';
import { dispatchCommunityEmails } from '@/lib/communityEmails';
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.LESSON_EMAIL_WORKER_SECRET;
  const scheduler = !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
  if (!scheduler) {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data } = await db.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!data?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!checkRateLimit(`community-retry:${user.id}`, 2, 60_000).allowed) return NextResponse.json({ error: 'Try later' }, { status: 429 });
  }
  const { error } = await createAdminClient().from('community_email_jobs').select('id').limit(1);
  if (error) return NextResponse.json({ error: 'Database update required' }, { status: 503 });
  after(async () => { try { await dispatchCommunityEmails(); } catch { console.error('Community email queue requires retry'); } });
  return NextResponse.json({ queued: true });
}
