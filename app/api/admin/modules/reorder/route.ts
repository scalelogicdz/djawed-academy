import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, isUuid, readJsonObject } from '@/lib/security';

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

  const rate = checkRateLimit(`admin-module-order:${admin.id}`, 60, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جدًا. حاول مرة أخرى بعد قليل.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const body = await readJsonObject(request, 32 * 1024);
  const courseId = body && isUuid(body.courseId) ? body.courseId : '';
  const moduleIds = body && Array.isArray(body.moduleIds)
    ? body.moduleIds.filter((id): id is string => isUuid(id))
    : [];

  if (!body || !courseId || moduleIds.length === 0 || moduleIds.length > 500 || moduleIds.length !== (Array.isArray(body.moduleIds) ? body.moduleIds.length : 0) || new Set(moduleIds).size !== moduleIds.length) {
    return NextResponse.json({ error: 'ترتيب الوحدات غير صالح' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: courseModules, error: readError } = await adminClient
    .from('modules')
    .select('id')
    .eq('course_id', courseId);

  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });

  const existingIds = (courseModules ?? []).map((module) => module.id);
  const existingSet = new Set(existingIds);
  const submittedSet = new Set(moduleIds);

  if (
    existingIds.length !== moduleIds.length ||
    moduleIds.some((id: string) => !existingSet.has(id)) ||
    existingIds.some((id) => !submittedSet.has(id))
  ) {
    return NextResponse.json({ error: 'يجب إرسال جميع وحدات الدورة عند تغيير الترتيب' }, { status: 400 });
  }

  const results = await Promise.all(
    moduleIds.map((id: string, position: number) =>
      adminClient.from('modules').update({ position }).eq('id', id).eq('course_id', courseId)
    )
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
