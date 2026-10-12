import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, isUuid, readJsonObject } from '@/lib/security';
import { dispatchCommunityEmails } from '@/lib/communityEmails';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export async function GET() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [inbox, unread] = await Promise.all([
    db.rpc('community_notification_inbox').order('created_at', { ascending: false }).limit(30),
    db.rpc('community_notification_inbox', {}, { count: 'exact', head: true }).eq('is_read', false),
  ]);
  if (inbox.error || unread.error) {
    const missing = ['PGRST202', '42883'].includes(inbox.error?.code ?? unread.error?.code ?? '');
    return NextResponse.json({ error: missing ? 'migration_required' : 'Notifications unavailable' }, { status: 503 });
  }
  if (checkRateLimit('community-email-worker', 1, 60_000).allowed) {
    after(async () => { try { await dispatchCommunityEmails(); } catch { console.error('Community email queue requires retry'); } });
  }
  return NextResponse.json({ notifications: inbox.data ?? [], unreadCount: unread.count ?? 0 }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function PATCH(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await readJsonObject(request, 2048);
  if (!body || (body.all !== true && (!isUuid(body.id) || !['legacy', 'community'].includes(String(body.source))))) return NextResponse.json({ error: 'Invalid notification' }, { status: 400 });
  const { error } = await db.rpc('mark_community_notifications_read', { notification_id: body.all === true ? null : body.id, notification_source: body.all === true ? null : body.source });
  const missing = error && ['PGRST202', '42883'].includes(error.code);
  return NextResponse.json(error ? { error: missing ? 'migration_required' : 'Update failed' } : { ok: true }, { status: missing ? 503 : error ? 500 : 200 });
}
