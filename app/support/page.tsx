import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import SupportForm from '@/components/SupportForm';

function SupportIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-6h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 13h4v6H6a2 2 0 0 1-2-2v-4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 19c0 1.1-.9 2-2 2h-2" strokeLinecap="round" />
    </svg>
  );
}

export default async function SupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, full_name, is_admin')
    .eq('id', user.id)
    .single();

  const defaultName = profile?.display_name || profile?.full_name || '';
  const defaultEmail = user.email || '';

  return (
    <>
      <StudentNav isAdmin={!!profile?.is_admin} currentUserId={user.id} />
      <section className="max-w-[820px] mx-auto px-5 sm:px-6 py-10 sm:py-14">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl border border-gold/35 bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
            <SupportIcon />
          </div>
          <div>
            <div className="eyebrow mb-2">الدعم</div>
            <h1 className="font-cairo font-extrabold text-[26px] sm:text-[31px]">تواصل مع الإدارة</h1>
          </div>
        </div>

        <p className="text-muted text-sm sm:text-[15px] leading-7 mb-7">
          عندك سؤال أو تحتاج مساعدة مباشرة؟ أرسل طلبك من هنا، وسنتواصل معك خارج المنصة عبر البريد الإلكتروني الذي تضعه في النموذج.
        </p>

        <SupportForm userId={user.id} defaultName={defaultName} defaultEmail={defaultEmail} />
      </section>
    </>
  );
}
