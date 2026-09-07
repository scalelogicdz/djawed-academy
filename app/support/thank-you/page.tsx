import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';

export default async function SupportThankYouPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  return (
    <>
      <StudentNav isAdmin={!!profile?.is_admin} currentUserId={user.id} />
      <section className="max-w-[720px] mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <div className="card p-7 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-gold/12 border border-gold/35 text-gold flex items-center justify-center mx-auto mb-5 text-3xl">
            ✓
          </div>
          <h1 className="font-cairo font-extrabold text-[27px] sm:text-[32px] mb-4">تم استلام طلبك</h1>
          <p className="text-muted leading-8 max-w-[520px] mx-auto mb-7">
            شكراً لتواصلك معنا. تم إرسال رسالتك للإدارة، وسنتواصل معك عبر البريد الإلكتروني الذي أدخلته في أقرب وقت ممكن.
          </p>
          <Link href="/dashboard" className="btn-primary inline-flex items-center justify-center">
            العودة إلى لوحة التحكم
          </Link>
        </div>
      </section>
    </>
  );
}
