import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import ServiceComingSoonPage from '@/components/ServiceComingSoonPage';

export default async function MarketingConsultationServicePage() {
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
      <ServiceComingSoonPage
        title="استشارة التسويق والإعلانات"
        description="جلسة عملية لمراجعة وضعك الحالي في التسويق والإعلانات، تحديد نقاط الضعف، وتوضيح الاتجاه والقرارات التي تحتاجها لتحسين الأداء بشكل أكثر احترافية."
        image="/services/consultation.webp"
        whatsappMessage="مرحبًا، تواصلت معك من صفحة خدمة استشارة التسويق والإعلانات في المنصة. أريد معرفة التفاصيل عندما تصبح الخدمة متاحة."
      />
    </>
  );
}
