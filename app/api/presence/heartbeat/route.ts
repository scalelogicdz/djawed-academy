import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { browserLabel, browserToken, DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS, tokenHash, sameOrigin } from '@/lib/accountAccess';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({error:'طلب غير صالح'}, {status:403});
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
      path = body.path.split('?')[0].split('#')[0];
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

  const jar=await cookies();
  const token=browserToken(jar.get(DEVICE_COOKIE)?.value);
  jar.set(DEVICE_COOKIE,token,DEVICE_COOKIE_OPTIONS);
  const {error:browserError}=await adminClient.rpc('record_browser_connection',{
    p_user:user.id,p_hash:tokenHash(token),p_label:browserLabel(request.headers.get('user-agent')||''),p_path:path,
  });
  if(browserError)return NextResponse.json({error:'تعذّر تحديث المتصفحات النشطة'}, {status:503});
  return NextResponse.json({ ok: true, tracked: true });
}
