import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  checkRateLimit,
  cleanEmail,
  cleanText,
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
  return checkRateLimit(`admin-students:${adminId}`, 60, 60_000);
}

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'طلبات كثيرة جدًا. حاول مرة أخرى بعد قليل.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}

function cleanCourseIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  if (value.length > 50) return null;
  const ids = value.filter((id): id is string => isUuid(id));
  if (ids.length !== value.length || new Set(ids).size !== ids.length) return null;
  return ids;
}

// Create a new student account (used right after you confirm BaridiMob/CCP payment)
export async function POST(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const rate = rateLimited(admin.id);
  if (!rate.allowed) return tooManyRequests(rate.retryAfterSeconds);

  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });

  const fullName = cleanText(body.fullName, 2, 120);
  const displayName =
    body.displayName == null || body.displayName === ''
      ? fullName
      : cleanText(body.displayName, 2, 80);
  const email = cleanEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const courseIds = cleanCourseIds(body.courseIds);

  if (!fullName || !displayName || !email || password.length < 6 || password.length > 128 || !courseIds) {
    return NextResponse.json({ error: 'بيانات الطالب غير صالحة' }, { status: 400 });
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

  const studentId = created.user.id;
  const { error: profileError } = await adminClient.from('profiles').insert({
    id: studentId,
    full_name: fullName,
    display_name: displayName,
    is_admin: false,
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(studentId);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (courseIds.length > 0) {
    const rows = courseIds.map((courseId) => ({ student_id: studentId, course_id: courseId }));
    const { error: enrollmentError } = await adminClient.from('enrollments').insert(rows);

    if (enrollmentError) {
      await adminClient.auth.admin.deleteUser(studentId);
      return NextResponse.json({ error: enrollmentError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, studentId });
}

export async function PATCH(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const rate = rateLimited(admin.id);
  if (!rate.allowed) return tooManyRequests(rate.retryAfterSeconds);

  const body = await readJsonObject(request);
  if (!body) return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });

  const studentId = isUuid(body.studentId) ? body.studentId : null;
  const fullName = cleanText(body.fullName, 2, 120);
  const displayName =
    body.displayName == null || body.displayName === ''
      ? fullName
      : cleanText(body.displayName, 2, 80);
  const email = cleanEmail(body.email);
  const password = body.password == null || body.password === '' ? '' : String(body.password);

  if (!studentId || !fullName || !displayName || !email || password.length > 128) {
    return NextResponse.json({ error: 'بيانات الطالب غير صالحة' }, { status: 400 });
  }

  if (password && password.length < 6) {
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
    email,
    email_confirm: true,
  };
  if (password) authUpdates.password = password;

  const { data: updatedAuth, error: authError } = await adminClient.auth.admin.updateUserById(studentId, authUpdates);

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { data: updatedProfile, error: profileError } = await adminClient
    .from('profiles')
    .update({
      full_name: fullName,
      display_name: displayName,
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
      email: updatedAuth.user?.email ?? email,
    },
  });
}

// Permanently delete a student account.
export async function DELETE(request: Request) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const rate = rateLimited(admin.id);
  if (!rate.allowed) return tooManyRequests(rate.retryAfterSeconds);

  const body = await readJsonObject(request, 8 * 1024);
  const studentId = body && isUuid(body.studentId) ? body.studentId : null;

  if (!studentId) {
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
