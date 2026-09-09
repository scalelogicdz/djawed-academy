import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const body = await request.json();
  const moduleId = typeof body.moduleId === 'string' ? body.moduleId : '';
  const lessonIds = Array.isArray(body.lessonIds)
    ? body.lessonIds.filter((id: unknown) => typeof id === 'string')
    : [];

  if (!moduleId || lessonIds.length === 0 || new Set(lessonIds).size !== lessonIds.length) {
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
