import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';

const services = [
  {
    title: 'كوتشينغ فردي 1:1',
    description: 'جلسات فردية مركزة لمساعدتك على تطوير مهاراتك، حل التحديات، والوصول إلى أهدافك بخطة واضحة.',
    image: '/services/coaching.webp',
  },
  {
    title: 'استشارة التسويق والإعلانات',
    description: 'جلسة عملية لتحليل وضعك الحالي وبناء اتجاه أوضح للتسويق والإعلانات واتخاذ قرارات أفضل.',
    image: '/services/consultation.webp',
  },
  {
    title: 'إنشاء المتاجر الإلكترونية',
    description: 'بناء متجر إلكتروني احترافي ومنظم ليكون جاهزًا لعرض منتجاتك والانطلاق في البيع أونلاين.',
    image: '/services/store-building.webp',
  },
];

export default async function ServicesPage() {
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
      <StudentNav isAdmin={profile?.is_admin} currentUserId={user.id} />

      <main className="max-w-[1180px] mx-auto px-5 sm:px-6 py-10 sm:py-14">
        <section className="text-center max-w-[760px] mx-auto mb-9 sm:mb-12">
          <div className="eyebrow justify-center [&::before]:hidden mb-3">خدماتنا</div>
          <h1 className="font-heading font-bold text-[30px] sm:text-[38px] leading-tight mb-4">
            خدمات إضافية تساعدك على التقدم بشكل أسرع
          </h1>
          <p className="text-muted text-[14px] sm:text-[15.5px] leading-8">
            اختر الخدمة المناسبة حسب احتياجك، سواء كنت تريد تطوير مهاراتك بشكل فردي، مراجعة التسويق والإعلانات، أو بناء متجر إلكتروني جاهز للانطلاق.
          </p>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {services.map((service) => (
            <article
              key={service.title}
              className="group overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#111925] shadow-[0_20px_45px_-28px_rgba(0,0,0,0.85)] transition duration-300 hover:-translate-y-1 hover:border-gold/30"
            >
              <div className="aspect-[4/3] bg-[#F6F0E7] overflow-hidden">
                <img
                  src={service.image}
                  alt={service.title}
                  className="w-full h-full object-cover transition duration-500 group-hover:scale-[1.025]"
                />
              </div>

              <div className="p-5 sm:p-6">
                <h2 className="font-heading font-bold text-[20px] sm:text-[21px] mb-3">
                  {service.title}
                </h2>
                <p className="text-muted text-[13.5px] leading-7 min-h-[84px]">
                  {service.description}
                </p>

                <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-gold">اكتشف الخدمة</span>
                  <span className="w-9 h-9 rounded-full border border-gold/25 bg-gold/[0.07] text-gold inline-flex items-center justify-center transition group-hover:bg-gold/10 group-hover:border-gold/40">
                    ←
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-9 sm:mt-12 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 sm:px-7 py-5 sm:py-6 text-center">
          <p className="text-muted text-[13.5px] sm:text-[14px] leading-7">
            قريبًا سيكون لكل خدمة صفحة مستقلة فيها التفاصيل الكاملة وطريقة طلب الخدمة.
          </p>
        </section>
      </main>
    </>
  );
}
