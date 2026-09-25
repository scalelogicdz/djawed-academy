import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  checkRateLimit,
  cleanOptionalText,
  cleanPosition,
  cleanText,
  cleanWebUrl,
  isUuid,
  readJsonObject,
} from '@/lib/security';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  return profile?.is_admin ? user : null;
}

function rateLimited(adminId: string) {
  return checkRateLimit(`admin-content:${adminId}`, 120, 60_000);
}

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'طلبات كثيرة جدًا. حاول مرة أخرى بعد قليل.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}

function parseQuiz(body: Record<string, unknown>) {
  const question = cleanText(body.question, 1, 1000);
  const options = Array.isArray(body.options)
    ? body.options.map((option) => cleanText(option, 1, 500))
    : [];
  const correctIndex = body.correctIndex;
  const valid =
    !!question &&
    options.length >= 2 &&
    options.length <= 10 &&
    options.every((option): option is string => typeof option === 'string') &&
    Number.isInteger(correctIndex) &&
    Number(correctIndex) >= 0 &&
    Number(correctIndex) < options.length;

  return valid
    ? { question, options, correctIndex: Number(correctIndex) }
    : null;
}

// body: { type: 'module' | 'lesson' | 'quizQuestion', ...fields }
export async function POST(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const rate = rateLimited(admin.id);
  if (!rate.allowed) return tooManyRequests(rate.retryAfterSeconds);

  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });

  const adminClient = createAdminClient();

  if (body.type === 'module') {
    const courseId = isUuid(body.courseId) ? body.courseId : null;
    const title = cleanText(body.title, 1, 180);
    const description = cleanOptionalText(body.description, 5000);
    const thumbnailUrl = cleanWebUrl(body.thumbnailUrl);
    const position = cleanPosition(body.position);

    if (!courseId || !title || description === undefined || thumbnailUrl === undefined || position === null) {
      return NextResponse.json({ error: 'بيانات الوحدة غير صالحة' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('modules')
      .insert({
        course_id: courseId,
        title,
        description,
        thumbnail_url: thumbnailUrl,
        position,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, module: data });
  }

  if (body.type === 'lesson') {
    const moduleId = isUuid(body.moduleId) ? body.moduleId : null;
    const title = cleanText(body.title, 1, 180);
    const description = cleanOptionalText(body.description, 5000);
    const videoId = cleanOptionalText(body.videoId, 200);
    const videoProvider = body.videoProvider === 'vimeo' ? 'vimeo' : body.videoProvider === 'bunny' || body.videoProvider == null ? 'bunny' : null;
    const resourceUrl = cleanWebUrl(body.resourceUrl);
    const position = cleanPosition(body.position);

    if (!moduleId || !title || description === undefined || videoId === undefined || !videoProvider || resourceUrl === undefined || position === null) {
      return NextResponse.json({ error: 'بيانات الدرس غير صالحة' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('lessons')
      .insert({
        module_id: moduleId,
        title,
        description,
        video_id: videoId,
        video_provider: videoProvider,
        resource_url: resourceUrl,
        position,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, lesson: data });
  }

  if (body.type === 'quizQuestion') {
    const lessonId = isUuid(body.lessonId) ? body.lessonId : null;
    const quiz = parseQuiz(body);
    const position = cleanPosition(body.position);

    if (!lessonId || !quiz || position === null) {
      return NextResponse.json({ error: 'بيانات السؤال غير صالحة' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('quiz_questions')
      .insert({
        lesson_id: lessonId,
        question: quiz.question,
        options: quiz.options,
        correct_index: quiz.correctIndex,
        position,
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

  const rate = rateLimited(admin.id);
  if (!rate.allowed) return tooManyRequests(rate.retryAfterSeconds);

  const body = await readJsonObject(request);
  if (!body || !isUuid(body.id)) return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });

  const adminClient = createAdminClient();

  if (body.type === 'lesson') {
    const title = cleanText(body.title, 1, 180);
    const description = cleanOptionalText(body.description, 5000);
    const videoId = cleanOptionalText(body.videoId, 200);
    const videoProvider = body.videoProvider === 'vimeo' ? 'vimeo' : body.videoProvider === 'bunny' || body.videoProvider == null ? 'bunny' : null;
    const resourceUrl = cleanWebUrl(body.resourceUrl);

    if (!title || description === undefined || videoId === undefined || !videoProvider || resourceUrl === undefined) {
      return NextResponse.json({ error: 'بيانات الدرس غير صالحة' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('lessons')
      .update({
        title,
        description,
        video_id: videoId,
        video_provider: videoProvider,
        resource_url: resourceUrl,
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, lesson: data });
  }

  if (body.type === 'module') {
    const title = cleanText(body.title, 1, 180);
    const description = cleanOptionalText(body.description, 5000);
    const thumbnailUrl = cleanWebUrl(body.thumbnailUrl);

    if (!title || description === undefined || thumbnailUrl === undefined) {
      return NextResponse.json({ error: 'بيانات الوحدة غير صالحة' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('modules')
      .update({
        title,
        description,
        thumbnail_url: thumbnailUrl,
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, module: data });
  }

  if (body.type === 'quizQuestion') {
    const quiz = parseQuiz(body);
    if (!quiz) return NextResponse.json({ error: 'بيانات السؤال غير صالحة' }, { status: 400 });

    const { data, error } = await adminClient
      .from('quiz_questions')
      .update({
        question: quiz.question,
        options: quiz.options,
        correct_index: quiz.correctIndex,
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, question: data });
  }

  return NextResponse.json({ error: 'نوع غير معروف' }, { status: 400 });
}

// body: { type: 'module' | 'lesson' | 'quizQuestion', id }
export async function DELETE(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const rate = rateLimited(admin.id);
  if (!rate.allowed) return tooManyRequests(rate.retryAfterSeconds);

  const body = await readJsonObject(request, 8 * 1024);
  if (!body || !isUuid(body.id)) return NextResponse.json({ error: 'المعرّف غير صالح' }, { status: 400 });

  const adminClient = createAdminClient();

  if (body.type === 'module') {
    const { error } = await adminClient.from('modules').delete().eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.type === 'lesson') {
    const { error } = await adminClient.from('lessons').delete().eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.type === 'quizQuestion') {
    const { error } = await adminClient.from('quiz_questions').delete().eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'نوع غير معروف' }, { status: 400 });
}
