import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

  return { user, isAdmin: !!profile?.is_admin };
}

export async function PATCH(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const body = await request.json();
  const postId = typeof body.id === 'string' ? body.id : '';
  const postBody = typeof body.body === 'string' ? body.body.trim() : '';

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
    .select('id, body, created_at, student_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, post: data });
}

export async function DELETE(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const body = await request.json();
  const postId = typeof body.id === 'string' ? body.id : '';

  if (!postId) return NextResponse.json({ error: 'معرّف المنشور مفقود' }, { status: 400 });

  const adminClient = createAdminClient();
  const { data: post, error: readError } = await adminClient
    .from('questions')
    .select('id, student_id')
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
  return NextResponse.json({ ok: true });
}
