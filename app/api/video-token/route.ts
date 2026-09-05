import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateBunnyEmbedToken } from '@/lib/bunnyToken';

// body: { lessonId: string }
// Returns a short-lived Bunny embed token — but only if the requesting user is
// actually logged in AND enrolled in the course this lesson belongs to.
// This mirrors the exact same enrollment check already enforced by RLS on the
// lessons table, so a student can never get a token for a course they haven't paid for.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const body = await request.json();
  const lessonId = body.lessonId;
  if (!lessonId) {
    return NextResponse.json({ error: 'معرّف الدرس مفقود' }, { status: 400 });
  }

  // This select goes through the normal (non-admin) client, so it's already
  // subject to the same RLS enrollment policy used everywhere else — if the
  // student isn't enrolled in this lesson's course, this returns nothing.
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, video_id, video_provider')
    .eq('id', lessonId)
    .single();

  if (!lesson || !lesson.video_id) {
    return NextResponse.json({ error: 'الدرس غير موجود أو غير متاح' }, { status: 404 });
  }

  if (lesson.video_provider === 'vimeo') {
    return NextResponse.json({ error: 'هذا الفيديو لا يستخدم Bunny Stream' }, { status: 400 });
  }

  try {
    const { token, expires } = generateBunnyEmbedToken(lesson.video_id, 300);
    return NextResponse.json({ token, expires });
  } catch (e) {
    return NextResponse.json({ error: 'تعذر إنشاء رمز التشغيل' }, { status: 500 });
  }
}
