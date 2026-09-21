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

export async function PATCH(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const { studentId, fullName, displayName, email, password } = await request.json();

  if (!studentId || typeof studentId !== 'string') {
    return NextResponse.json({ error: 'معرّف الطالب غير صالح' }, { status: 400 });
  }

  if (!fullName?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'الاسم والبريد الإلكتروني مطلوبان' }, { status: 400 });
  }

  if (password && String(password).length < 6) {
    return NextResponse.json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: targetProfile, error: profileReadError } = await adminClient
    .from('profiles')
    .select('id, is_admin')
    .eq('id', studentId)
    .maybeSingle();

  if (profileReadError) {
    return NextResponse.json({ error: profileReadError.message }, { status: 400 });
  }

  if (!targetProfile) {
    return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 });
  }

  if (targetProfile.is_admin) {
    return NextResponse.json({ error: 'لا يمكن تعديل حساب إداري من صفحة الطلاب' }, { status: 400 });
  }

  const authUpdates: { email: string; password?: string; email_confirm?: boolean } = {
    email: email.trim(),
    email_confirm: true,
  };
  if (password) authUpdates.password = String(password);

  const { data: updatedAuth, error: authError } = await adminClient.auth.admin.updateUserById(studentId, authUpdates);

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const cleanFullName = fullName.trim();
  const cleanDisplayName = displayName?.trim() || cleanFullName;

  const { data: updatedProfile, error: profileError } = await adminClient
    .from('profiles')
    .update({
      full_name: cleanFullName,
      display_name: cleanDisplayName,
    })
    .eq('id', studentId)
    .select('id, full_name, display_name, created_at')
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    student: {
      ...updatedProfile,
      email: updatedAuth.user?.email ?? email.trim(),
    },
  });
}

// Permanently delete a student account.
// Deleting the Supabase Auth user cascades to profiles, enrollments,
// progress, questions, replies, and any other relations configured
// with ON DELETE CASCADE.
export async function DELETE(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const { studentId } = await request.json();

  if (!studentId || typeof studentId !== 'string') {
    return NextResponse.json({ error: 'معرّف الطالب غير صالح' }, { status: 400 });
  }

  if (studentId === admin.id) {
    return NextResponse.json({ error: 'لا يمكنك حذف حسابك الإداري' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: targetProfile, error: profileReadError } = await adminClient
    .from('profiles')
    .select('id, is_admin')
    .eq('id', studentId)
    .maybeSingle();

  if (profileReadError) {
    return NextResponse.json({ error: profileReadError.message }, { status: 400 });
  }

  if (!targetProfile) {
    return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 });
  }

  if (targetProfile.is_admin) {
    return NextResponse.json({ error: 'لا يمكن حذف حساب إداري من صفحة الطلاب' }, { status: 400 });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(studentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
