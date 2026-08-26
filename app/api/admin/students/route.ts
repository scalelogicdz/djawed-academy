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

// Create a new student account (used right after you confirm BaridiMob/CCP payment)
export async function POST(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const { fullName, displayName, email, password, courseIds } = await request.json();

  if (!fullName || !email || !password) {
    return NextResponse.json({ error: 'الحقول المطلوبة ناقصة' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? 'فشل إنشاء الحساب' }, { status: 400 });
  }

  const { error: profileError } = await adminClient.from('profiles').insert({
    id: created.user.id,
    full_name: fullName,
    display_name: displayName || fullName,
    is_admin: false,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (Array.isArray(courseIds) && courseIds.length > 0) {
    const rows = courseIds.map((courseId: string) => ({ student_id: created.user!.id, course_id: courseId }));
    await adminClient.from('enrollments').insert(rows);
  }

  return NextResponse.json({ ok: true, studentId: created.user.id });
}
