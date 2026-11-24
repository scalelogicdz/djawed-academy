import { sameOrigin } from '@/lib/accountAccess';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, isUuid, readJsonObject } from '@/lib/security';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  return profile?.is_admin ? user : null;
}

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'طلبات كثيرة جدًا. حاول مرة أخرى بعد قليل.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}

async function getIds(request: Request) {
  const body = await readJsonObject(request, 8 * 1024);
  if (!body || !isUuid(body.studentId) || !isUuid(body.courseId)) return null;
  return { studentId: body.studentId, courseId: body.courseId };
}

// Grant access
export async function POST(request: Request) {
  if(!sameOrigin(request)) return NextResponse.json({error:'Invalid origin'},{status:403});
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const rate = checkRateLimit(`admin-enrollments:${admin.id}`, 120, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.retryAfterSeconds);

  const ids = await getIds(request);
  if (!ids) return NextResponse.json({ error: 'بيانات التسجيل غير صالحة' }, { status: 400 });

  const adminClient = createAdminClient();
  const {data:profile,error:profileError}=await adminClient.from('profiles').select('*').eq('id',ids.studentId).single();
  if(profileError||!profile||profile.is_admin)return NextResponse.json({error:'Invalid student'},{status:400});
  if(profile.access_mode==='trial') {
    const {error}=await adminClient.rpc('upgrade_trial_student',{p_student:ids.studentId,p_course:ids.courseId});
    if(error)return NextResponse.json({error:'تعذرت ترقية الحساب'},{status:409});
    return NextResponse.json({ok:true,accessMode:'full'});
  }
  const { error } = await adminClient.from('enrollments').upsert({student_id:ids.studentId,course_id:ids.courseId},{onConflict:'student_id,course_id'});

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Remove access
export async function DELETE(request: Request) {
  if(!sameOrigin(request)) return NextResponse.json({error:'Invalid origin'},{status:403});
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

  const rate = checkRateLimit(`admin-enrollments:${admin.id}`, 120, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.retryAfterSeconds);

  const ids = await getIds(request);
  if (!ids) return NextResponse.json({ error: 'بيانات التسجيل غير صالحة' }, { status: 400 });

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('enrollments')
    .delete()
    .eq('student_id', ids.studentId)
    .eq('course_id', ids.courseId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
