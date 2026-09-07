import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import { getServicesContent } from '@/lib/siteContent';

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

  const { data: contentRow } = await supabase
    .from('site_content')
    .select('content')
    .eq('key', 'services')
    .maybeSingle();

  const content = getServicesContent(contentRow?.content);

  return (
    <>
      <StudentNav isAdmin={profile?.is_admin} currentUserId={user.id} />

      <main className="max-w-[1180px] mx-auto px-5 sm:px-6 py-10 sm:py-14">
        <section className="text-center max-w-[760px] mx-auto mb-9 sm:mb-12">
          <div className="eyebrow justify-center [&::before]:hidden mb-3">{content.eyebrow}</div>
          <h1 className="font-heading font-bold text-[30px] sm:text-[38px] leading-tight mb-4">
            {content.heading}
          </h1>
          <p className="text-muted text-[14px] sm:text-[15.5px] leading-8">
            {content.intro}
          </p>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {content.services.map((service) => (
            <article
              key={service.image}
              className="group overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#111925] shadow-[0_20px_45px_-28px_rgba(0,0,0,0.85)] transition duration-300 hover:-translate-y-1 hover:border-gold/30 flex flex-col"
            >
              <div className="aspect-[4/3] bg-[#F6F0E7] overflow-hidden">
                <img
                  src={service.image}
                  alt={service.title}
                  className="w-full h-full object-cover transition duration-500 group-hover:scale-[1.025]"
                />
              </div>

              <div className="p-5 sm:p-6 flex flex-col flex-1">
                <h2 className="font-heading font-bold text-[20px] sm:text-[21px] mb-3">
                  {service.title}
                </h2>
                <p className="text-muted text-[13.5px] leading-7 min-h-[84px]">
                  {service.description}
                </p>

                <div className="mt-auto pt-6 flex justify-center">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 min-w-[170px] rounded-xl border border-gold/45 bg-gold/[0.08] px-5 py-3 text-[14px] font-bold font-cairo text-gold transition duration-200 hover:bg-gold hover:text-[#0A0F1A] hover:border-gold"
                  >
                    <span>{content.cta}</span>
                    <span className="text-[16px]">←</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-9 sm:mt-12 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 sm:px-7 py-5 sm:py-6 text-center">
          <p className="text-muted text-[13.5px] sm:text-[14px] leading-7">
            {content.footerNote}
          </p>
        </section>
      </main>
    </>
  );
}
