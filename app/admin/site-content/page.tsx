import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminBackButton from '@/components/AdminBackButton';
import SiteContentManager from '@/components/SiteContentManager';
import { getGuidelinesContent, getServicesContent } from '@/lib/siteContent';

export default async function AdminSiteContentPage() {
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

  if (!profile?.is_admin) redirect('/dashboard');

  const { data: rows } = await supabase
    .from('site_content')
    .select('key, content')
    .in('key', ['services', 'guidelines']);

  const servicesRow = rows?.find((row) => row.key === 'services');
  const guidelinesRow = rows?.find((row) => row.key === 'guidelines');

  const services = getServicesContent(servicesRow?.content);
  const guidelines = getGuidelinesContent(guidelinesRow?.content);

  return (
    <section className="max-w-[1050px] mx-auto px-5 sm:px-6 py-10 sm:py-12">
      <div className="mb-5">
        <AdminBackButton />
      </div>

      <div className="eyebrow">لوحة الإدارة</div>
      <h1 className="font-cairo font-extrabold text-[27px] sm:text-[31px] mb-2">إدارة المحتوى</h1>
      <p className="text-muted text-sm leading-7 mb-8 max-w-[760px]">
        من هنا تقدر تعدل النصوص الظاهرة في صفحة الخدمات وصفحة قواعد وإرشادات المنصة بدون الحاجة لتعديل الكود.
      </p>

      <SiteContentManager initialServices={services} initialGuidelines={guidelines} />
    </section>
  );
}
