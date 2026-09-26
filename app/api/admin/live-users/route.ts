import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('profiles')
    .select('id, full_name, display_name, last_seen_at, last_seen_path')
    .eq('is_admin', false)
    .gte('last_seen_at', cutoff)
    .order('last_seen_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'تعذر قراءة المستخدمين المتصلين' }, { status: 400 });
  }

  return NextResponse.json(
    {
      users: (data ?? []).map((student) => ({
        id: student.id,
        name: student.display_name || student.full_name || 'طالب',
        path: student.last_seen_path || '/dashboard',
        lastSeenAt: student.last_seen_at,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
