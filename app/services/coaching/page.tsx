import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import ServiceComingSoonPage from '@/components/ServiceComingSoonPage';

export default async function CoachingServicePage() {
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
        title="كوتشينغ فردي 1:1"
        description="جلسات فردية مركزة لمساعدتك على تطوير مهاراتك، حل التحديات التي تواجهك، وبناء خطة أوضح للوصول إلى أهدافك بشكل عملي ومنظم."
        image="/services/coaching.webp"
        whatsappMessage="مرحبًا، تواصلت معك من صفحة خدمة الكوتشينغ الفردي 1:1 في المنصة. أريد معرفة التفاصيل عندما تصبح الخدمة متاحة."
      />
    </>
  );
}
