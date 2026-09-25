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

  const rate = checkRateLimit(`admin-lesson-order:${admin.id}`, 60, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جدًا. حاول مرة أخرى بعد قليل.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const body = await readJsonObject(request, 32 * 1024);
  const moduleId = body && isUuid(body.moduleId) ? body.moduleId : '';
  const lessonIds = body && Array.isArray(body.lessonIds)
    ? body.lessonIds.filter((id): id is string => isUuid(id))
    : [];

  if (!body || !moduleId || lessonIds.length === 0 || lessonIds.length > 1000 || lessonIds.length !== (Array.isArray(body.lessonIds) ? body.lessonIds.length : 0) || new Set(lessonIds).size !== lessonIds.length) {
    return NextResponse.json({ error: 'ترتيب الدروس غير صالح' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: moduleLessons, error: readError } = await adminClient
    .from('lessons')
    .select('id')
    .eq('module_id', moduleId);

  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });

  const existingIds = (moduleLessons ?? []).map((lesson) => lesson.id);
  const existingSet = new Set(existingIds);
  const submittedSet = new Set(lessonIds);

  if (
    existingIds.length !== lessonIds.length ||
    lessonIds.some((id: string) => !existingSet.has(id)) ||
    existingIds.some((id) => !submittedSet.has(id))
  ) {
    return NextResponse.json({ error: 'يجب إرسال جميع دروس الوحدة عند تغيير الترتيب' }, { status: 400 });
  }

  const results = await Promise.all(
    lessonIds.map((id: string, position: number) =>
      adminClient.from('lessons').update({ position }).eq('id', id).eq('module_id', moduleId)
    )
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
