import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { presenceKeyForUser } from '@/lib/presence';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (profile?.is_admin) {
    return NextResponse.json({ error: 'الحساب الإداري لا يُحتسب ضمن الطلاب المتصلين' }, { status: 403 });
  }

  return NextResponse.json(
    { presenceKey: presenceKeyForUser(user.id) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
