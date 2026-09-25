import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, readJsonObject } from '@/lib/security';

const allowedKeys = new Set(['services', 'guidelines']);

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  return profile?.is_admin ? user : null;
}

export async function PATCH(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const rate = checkRateLimit(`admin-site-content:${admin.id}`, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جدًا. حاول مرة أخرى بعد قليل.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const body = await readJsonObject(request, 128 * 1024);
  if (!body) return NextResponse.json({ error: 'بيانات المحتوى غير صالحة' }, { status: 400 });

  const key = typeof body.key === 'string' ? body.key : '';
  const content = body.content;

  if (!allowedKeys.has(key) || !content || typeof content !== 'object' || Array.isArray(content)) {
    return NextResponse.json({ error: 'بيانات المحتوى غير صالحة' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.from('site_content').upsert(
    {
      key,
      content,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );

  if (error) {
    return NextResponse.json(
      {
        error:
          error.code === '42P01'
            ? 'جدول المحتوى غير موجود بعد. شغّل ملف Supabase الخاص بإدارة المحتوى أولاً.'
            : error.message,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
