import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  checkRateLimit,
  cleanText,
  isUuid,
  readJsonObject,
} from '@/lib/security';

export const runtime = 'nodejs';

const IMAGE_BUCKET = 'community-images';

async function getCurrentUser() {
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

  return { supabase, user, isAdmin: !!profile?.is_admin };
}

function storagePathFromPublicUrl(url: string | null) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'طلبات كثيرة جدًا. حاول مرة أخرى بعد قليل.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const body = await readJsonObject(request, 16 * 1024);
  if (!body) return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });

  if (body.type === 'question') {
    const rate = checkRateLimit(`community-question:${current.user.id}`, 10, 10 * 60_000);
    if (!rate.allowed) return tooManyRequests(rate.retryAfterSeconds);

    const text = cleanText(body.body, 1, 5000);
    if (!text) return NextResponse.json({ error: 'نص السؤال غير صالح' }, { status: 400 });

    const { data, error } = await current.supabase
      .from('questions')
      .insert({ body: text, student_id: current.user.id })
      .select('id, body, image_url, created_at, student_id')
      .single();

    if (error) return NextResponse.json({ error: 'تعذر نشر السؤال' }, { status: 400 });
    return NextResponse.json({ ok: true, question: data });
  }

  if (body.type === 'reply') {
    const rate = checkRateLimit(`community-reply:${current.user.id}`, 30, 10 * 60_000);
    if (!rate.allowed) return tooManyRequests(rate.retryAfterSeconds);

    const questionId = isUuid(body.questionId) ? body.questionId : null;
    const text = cleanText(body.body, 1, 5000);

    if (!questionId || !text) {
      return NextResponse.json({ error: 'بيانات الرد غير صالحة' }, { status: 400 });
    }

    const { data: question } = await current.supabase
      .from('questions')
      .select('id')
      .eq('id', questionId)
      .maybeSingle();

    if (!question) return NextResponse.json({ error: 'السؤال غير موجود' }, { status: 404 });

    const { data, error } = await current.supabase
      .from('replies')
      .insert({
        body: text,
        question_id: questionId,
        student_id: current.user.id,
      })
      .select('id, body, created_at, question_id, student_id')
      .single();

    if (error) return NextResponse.json({ error: 'تعذر نشر الرد' }, { status: 400 });
    return NextResponse.json({ ok: true, reply: data });
  }

  return NextResponse.json({ error: 'نوع غير معروف' }, { status: 400 });
}

export async function PATCH(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const rate = checkRateLimit(`community-edit:${current.user.id}`, 30, 10 * 60_000);
  if (!rate.allowed) return tooManyRequests(rate.retryAfterSeconds);

  const body = await readJsonObject(request, 16 * 1024);
  const postId = body && isUuid(body.id) ? body.id : null;
  const postBody = body ? cleanText(body.body, 1, 5000) : null;

  if (!postId || !postBody) {
    return NextResponse.json({ error: 'بيانات المنشور غير مكتملة' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data: post, error: readError } = await adminClient
    .from('questions')
    .select('id, student_id')
    .eq('id', postId)
    .single();

  if (readError || !post) {
    return NextResponse.json({ error: 'المنشور غير موجود' }, { status: 404 });
  }

  if (post.student_id !== current.user.id) {
    return NextResponse.json({ error: 'يمكنك تعديل منشوراتك فقط' }, { status: 403 });
  }

  const { data, error } = await adminClient
    .from('questions')
    .update({ body: postBody })
    .eq('id', postId)
    .select('id, body, image_url, created_at, student_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, post: data });
}

export async function DELETE(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const rate = checkRateLimit(`community-delete:${current.user.id}`, 20, 10 * 60_000);
  if (!rate.allowed) return tooManyRequests(rate.retryAfterSeconds);

  const body = await readJsonObject(request, 8 * 1024);
  const postId = body && isUuid(body.id) ? body.id : null;

  if (!postId) return NextResponse.json({ error: 'معرّف المنشور غير صالح' }, { status: 400 });

  const adminClient = createAdminClient();
  const { data: post, error: readError } = await adminClient
    .from('questions')
    .select('id, student_id, image_url')
    .eq('id', postId)
    .single();

  if (readError || !post) {
    return NextResponse.json({ error: 'المنشور غير موجود' }, { status: 404 });
  }

  if (!current.isAdmin && post.student_id !== current.user.id) {
    return NextResponse.json({ error: 'يمكنك حذف منشوراتك فقط' }, { status: 403 });
  }

  const { error } = await adminClient.from('questions').delete().eq('id', postId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const imagePath = storagePathFromPublicUrl(post.image_url);
  if (imagePath) await adminClient.storage.from(IMAGE_BUCKET).remove([imagePath]);

  return NextResponse.json({ ok: true });
}
