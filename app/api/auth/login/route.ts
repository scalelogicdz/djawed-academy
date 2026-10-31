import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { browserToken, DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS, DEVICE_LIMIT_MESSAGE, registerBrowser, sameOrigin, verifiedIdentity } from '@/lib/accountAccess';
import {
  checkRateLimit,
  cleanEmail,
  clientIp,
  readJsonObject,
} from '@/lib/security';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({error:'طلب غير صالح'}, {status:403});
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json(
      { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
      { status: 401 }
    );
  }

  try {
    const identity = await verifiedIdentity(supabase);
    if (!identity) throw new Error('session');
    const jar = await cookies();
    const token = browserToken(jar.get(DEVICE_COOKIE)?.value);
    jar.set(DEVICE_COOKIE, token, DEVICE_COOKIE_OPTIONS);
    const access = await registerBrowser(identity.user.id,identity.sessionId,token,request.headers.get('user-agent')||'');
    if (!access.allowed) return NextResponse.json({error:DEVICE_LIMIT_MESSAGE,redirect:'/devices'}, {status:403});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({error:'تعذّر التحقق من الأجهزة حاليًا. حاول مجددًا بعد قليل.'}, {status:503});
  }
}
