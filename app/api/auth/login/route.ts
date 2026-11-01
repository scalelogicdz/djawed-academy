import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { browserLabel, browserToken, DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS, tokenHash } from '@/lib/accountAccess';
import {
  checkRateLimit,
  cleanEmail,
  clientIp,
  readJsonObject,
} from '@/lib/security';

export async function POST(request: Request) {
  const body = await readJsonObject(request, 4 * 1024);
  if (!body) {
    return NextResponse.json({ error: 'بيانات الدخول غير صالحة' }, { status: 400 });
  }

  const email = cleanEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || password.length < 1 || password.length > 128) {
    return NextResponse.json({ error: 'بيانات الدخول غير صالحة' }, { status: 400 });
  }

  const ip = clientIp(request);
  const rate = checkRateLimit(`login:${ip}:${email}`, 8, 10 * 60_000);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'محاولات كثيرة جدًا. حاول مرة أخرى لاحقًا.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json(
      { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
      { status: 401 }
    );
  }

  // Count successful logins even if the student never opens a visible course page.
  // History collection must not prevent legitimate login if the database is unavailable.
  try {
    if(data.user){
      const jar=await cookies();
      const token=browserToken(jar.get(DEVICE_COOKIE)?.value);
      jar.set(DEVICE_COOKIE,token,DEVICE_COOKIE_OPTIONS);
      const result=await createAdminClient().rpc('record_browser_connection',{
        p_user:data.user.id,p_hash:tokenHash(token),p_label:browserLabel(request.headers.get('user-agent')||''),p_path:'/login',
      });
      if(result.error)console.error('Browser login history could not be saved');
    }
  } catch { console.error('Browser login history could not be saved'); }
  return NextResponse.json({ ok: true });
}

