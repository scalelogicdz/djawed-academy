import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json(
      { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
