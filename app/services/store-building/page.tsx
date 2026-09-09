import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import ServiceComingSoonPage from '@/components/ServiceComingSoonPage';

export default async function StoreBuildingServicePage() {
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
        title="إنشاء المتاجر الإلكترونية"
        description="خدمة لبناء متجر إلكتروني احترافي ومنظم، جاهز لعرض منتجاتك والانطلاق في البيع أونلاين بشكل أوضح وأسهل من ناحية تجربة المستخدم وتجهيز الأساسيات."
        image="/services/store-building.webp"
        whatsappMessage="مرحبًا، تواصلت معك من صفحة خدمة إنشاء المتاجر الإلكترونية في المنصة. أريد معرفة التفاصيل عندما تصبح الخدمة متاحة."
      />
    </>
  );
}
