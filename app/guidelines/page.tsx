import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import { getGuidelinesContent } from '@/lib/siteContent';

export default async function GuidelinesPage() {
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
    .eq('key', 'guidelines')
    .maybeSingle();

  const content = getGuidelinesContent(contentRow?.content);

  return (
    <>
      <StudentNav isAdmin={profile?.is_admin} currentUserId={user.id} />
      <main dir="rtl" className="max-w-[980px] mx-auto px-5 sm:px-6 py-10 sm:py-14">
        <div className="mb-8 text-right">
          <div className="eyebrow">{content.eyebrow}</div>
          <h1 className="font-cairo font-extrabold text-[27px] sm:text-[32px] leading-tight mb-3">
            {content.heading}
          </h1>
          <p className="text-muted leading-7 max-w-[720px]">
            {content.intro}
          </p>
        </div>

        <div className="space-y-5">
          {content.sections.map((section) => (
            <section key={section.number} className="card p-5 sm:p-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/30 text-gold font-bold flex items-center justify-center flex-shrink-0">
                  {section.number}
                </div>
                <h2 className="font-cairo font-extrabold text-[19px] sm:text-[21px]">
                  {section.title}
                </h2>
              </div>

              <ul className="space-y-3.5">
                {section.items.map((item, itemIndex) => (
                  <li key={`${section.number}-${itemIndex}`} className="flex items-start gap-3 text-[15px] sm:text-[16px] leading-7 text-text/90">
                    <span className="mt-[10px] w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
