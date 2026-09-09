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
  const courseId = typeof body.courseId === 'string' ? body.courseId : '';
  const moduleIds = Array.isArray(body.moduleIds) ? body.moduleIds.filter((id: unknown) => typeof id === 'string') : [];

  if (!courseId || moduleIds.length === 0 || new Set(moduleIds).size !== moduleIds.length) {
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
