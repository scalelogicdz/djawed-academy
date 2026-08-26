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

// Grant access
export async function POST(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const { studentId, courseId } = await request.json();
  const adminClient = createAdminClient();
  const { error } = await adminClient.from('enrollments').insert({ student_id: studentId, course_id: courseId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Remove access
export async function DELETE(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const { studentId, courseId } = await request.json();
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('enrollments')
    .delete()
    .eq('student_id', studentId)
    .eq('course_id', courseId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
