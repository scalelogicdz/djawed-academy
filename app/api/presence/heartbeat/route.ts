import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

  if (!profile || profile.is_admin) {
    return NextResponse.json({ ok: true, tracked: false });
  }

  let path = '/dashboard';

  try {
    const body = await request.json();
    if (
      typeof body?.path === 'string' &&
      body.path.startsWith('/') &&
      body.path.length <= 300
    ) {
      path = body.path;
    }
  } catch {
    // Keep the safe default path.
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('profiles')
    .update({
      last_seen_at: new Date().toISOString(),
      last_seen_path: path,
    })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: 'تعذر تحديث حالة الاتصال' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, tracked: true });
}
