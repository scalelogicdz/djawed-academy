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

// body: { type: 'module' | 'lesson', ...fields }
export async function POST(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const body = await request.json();
  const adminClient = createAdminClient();

  if (body.type === 'module') {
    const { data, error } = await adminClient
      .from('modules')
      .insert({ course_id: body.courseId, title: body.title, position: body.position ?? 0 })
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

  return NextResponse.json({ error: 'نوع غير معروف' }, { status: 400 });
}
