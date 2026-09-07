import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const IMAGE_BUCKET = 'community-images';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

function extensionForType(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

function storagePathFromPublicUrl(url: string | null) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const formData = await request.formData();
  const body = typeof formData.get('body') === 'string' ? String(formData.get('body')).trim() : '';
  const image = formData.get('image');

  if (!body) return NextResponse.json({ error: 'اكتب محتوى المنشور أولًا' }, { status: 400 });

  const adminClient = createAdminClient();
  let imageUrl: string | null = null;
  let uploadedPath: string | null = null;

  if (image instanceof File && image.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json({ error: 'الصورة يجب أن تكون JPG أو PNG أو WEBP' }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'حجم الصورة يجب ألا يتجاوز 5MB' }, { status: 400 });
    }

    uploadedPath = `${current.user.id}/${crypto.randomUUID()}.${extensionForType(image.type)}`;
    const bytes = new Uint8Array(await image.arrayBuffer());
    const { error: uploadError } = await adminClient.storage
      .from(IMAGE_BUCKET)
      .upload(uploadedPath, bytes, { contentType: image.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: `تعذر رفع الصورة: ${uploadError.message}` }, { status: 400 });
    }

    const { data: publicUrlData } = adminClient.storage.from(IMAGE_BUCKET).getPublicUrl(uploadedPath);
    imageUrl = publicUrlData.publicUrl;
  }

  const { data, error } = await adminClient
    .from('questions')
    .insert({
      body,
      student_id: current.user.id,
      image_url: imageUrl,
    })
    .select('id, body, image_url, created_at, student_id')
    .single();

  if (error) {
    if (uploadedPath) await adminClient.storage.from(IMAGE_BUCKET).remove([uploadedPath]);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, post: data });
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
    .select('id, body, image_url, created_at, student_id')
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
