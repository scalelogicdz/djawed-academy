import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  checkRateLimit,
  cleanEmail,
  cleanText,
  readJsonObject,
} from '@/lib/security';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  const rate = checkRateLimit(`support:${user.id}`, 5, 10 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'تم إرسال عدة طلبات خلال وقت قصير. حاول مرة أخرى لاحقًا.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const body = await readJsonObject(request, 16 * 1024);
  if (!body) return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 });

  const name = cleanText(body.name, 2, 120);
  const email = cleanEmail(body.email);
  const subject = cleanText(body.subject, 2, 160);
  const message = cleanText(body.message, 2, 3000);

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'يرجى التحقق من جميع الحقول' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.from('support_requests').insert({
    student_id: user.id,
    name,
    email,
    subject,
    message,
  });

  if (error) return NextResponse.json({ error: 'تعذر إرسال طلب الدعم' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
