import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  return profile?.is_admin ? user : null;
}

// body: { type: 'module' | 'lesson' | 'quizQuestion', ...fields }
export async function POST(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await request.json();
  const adminClient = createAdminClient();

  if (body.type === 'module') {
    const { data, error } = await adminClient
      .from('modules')
      .insert({
        course_id: body.courseId,
        title: body.title,
        description: body.description ?? null,
        thumbnail_url: body.thumbnailUrl ?? null,
        position: body.position ?? 0,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, module: data });
  }

  if (body.type === 'lesson') {
    const { data, error } = await adminClient
      .from('lessons')
      .insert({
        module_id: body.moduleId,
        title: body.title,
        description: body.description ?? null,
        video_id: body.videoId ?? null,
        video_provider: body.videoProvider ?? 'bunny',
        resource_url: body.resourceUrl ?? null,
        position: body.position ?? 0,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, lesson: data });
  }

  if (body.type === 'quizQuestion') {
    if (!body.lessonId || !body.question || !Array.isArray(body.options) || typeof body.correctIndex !== 'number') {
      return NextResponse.json({ error: 'بيانات السؤال غير مكتملة' }, { status: 400 });
    }
    const { data, error } = await adminClient
      .from('quiz_questions')
      .insert({
        lesson_id: body.lessonId,
        question: body.question,
        options: body.options,
        correct_index: body.correctIndex,
        position: body.position ?? 0,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, question: data });
  }

  return NextResponse.json({ error: 'نوع غير معروف' }, { status: 400 });
}

// body: { type: 'lesson' | 'module' | 'quizQuestion', id, ...fields }
export async function PATCH(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await request.json();
  const adminClient = createAdminClient();

  if (body.type === 'lesson') {
    if (!body.id) return NextResponse.json({ error: 'معرّف الدرس مفقود' }, { status: 400 });
    const { data, error } = await adminClient
      .from('lessons')
      .update({
        title: body.title,
        description: body.description ?? null,
        video_id: body.videoId ?? null,
        video_provider: body.videoProvider ?? 'bunny',
        resource_url: body.resourceUrl ?? null,
      })
      .eq('id', body.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, lesson: data });
  }

  if (body.type === 'module') {
    if (!body.id) return NextResponse.json({ error: 'معرّف الوحدة مفقود' }, { status: 400 });
    const thumbnailUrl = typeof body.thumbnailUrl === 'string' && body.thumbnailUrl.trim() ? body.thumbnailUrl.trim() : null;
    const { data, error } = await adminClient
      .from('modules')
      .update({
        title: body.title,
        description: body.description ?? null,
        thumbnail_url: thumbnailUrl,
      })
      .eq('id', body.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, module: data });
  }

  if (body.type === 'quizQuestion') {
    if (!body.id) return NextResponse.json({ error: 'معرّف السؤال مفقود' }, { status: 400 });
    const { data, error } = await adminClient
      .from('quiz_questions')
      .update({
        question: body.question,
        options: body.options,
        correct_index: body.correctIndex,
      })
      .eq('id', body.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, question: data });
  }

  return NextResponse.json({ error: 'نوع غير معروف' }, { status: 400 });
}

// body: { type: 'lesson' | 'quizQuestion', id }
export async function DELETE(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await request.json();
  const adminClient = createAdminClient();

  if (body.type === 'lesson') {
    if (!body.id) return NextResponse.json({ error: 'معرّف الدرس مفقود' }, { status: 400 });
    const { error } = await adminClient.from('lessons').delete().eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.type === 'quizQuestion') {
    if (!body.id) return NextResponse.json({ error: 'معرّف السؤال مفقود' }, { status: 400 });
    const { error } = await adminClient.from('quiz_questions').delete().eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'نوع غير معروف' }, { status: 400 });
}
