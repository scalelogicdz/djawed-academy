import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';

const sections = [
  {
    number: '1',
    title: 'الإحترام في التعامل',
    items: [
      'خلي كل منشوراتك وتعليقاتك إيجابية.',
      'كي ترد على كاش واحد، رد بهدف المساعدة، مش الهجوم أو الإساءة.',
      'تجنب السخرية والتعليقات المستفزة.',
      'خلي نقدك بناء، يوضح للشخص قصدك ويساعده يتقدم.',
      'اشكر الناس اللي يساعدوك.',
    ],
  },
  {
    number: '2',
    title: 'إرشادات النشر',
    items: [
      'كل كلامك يبقى عن الإعلانات الممولة خاصة، والبزنس عامة. هذا هو موضوع المنصة.',
      'تجنب السبام في النشر، اكتب سؤالك أو تعليقك مرة واحدة وبرك.',
    ],
  },
  {
    number: '3',
    title: 'التعاون والتفاعل',
    items: [
      'يفضل كي تشارك بأي معلومة أنك تذكر مصدرها، متخليهاش حكر على الناس.',
      'المنصة مبنية على تفاعل الأعضاء، كي تلقى سؤال عندك إجابته رد عليه.',
    ],
  },
  {
    number: '4',
    title: 'النشاطات الممنوعة',
    items: [
      'مش مسموح بالدعاية لأي خدمة أو موقع من غير الرجوع لإدارة المنصة والحصول على موافقتهم.',
      'مش مسموح بنشر أي لينكات أفيليت نهائياً.',
      'مش مسموح بنشر أو مشاركة أي أرقام تليفون نهائياً.',
      'مش مسموح دعوة الناس لأي جروبات خارج المنصة نهائياً. المنصة غير مسؤولة عن أي حاجة تصرا خارجها.',
    ],
  },
  {
    number: '5',
    title: 'الخصوصية والسرية',
    items: [
      'متشاركش أي معلومات شخصية بشكل عشوائي من غير سبب.',
      'متشاركش أي معلومات شخصية ممكن تكون تعرفها عن أي واحد داخل أو خارج المجتمع.',
      'متضغطش على أي واحد باه يعطيك معلوماته الشخصية.',
    ],
  },
];

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

  return (
    <>
      <StudentNav isAdmin={profile?.is_admin} currentUserId={user.id} />
      <main dir="rtl" className="max-w-[980px] mx-auto px-5 sm:px-6 py-10 sm:py-14">
        <div className="mb-8 text-right">
          <div className="eyebrow">المنصة</div>
          <h1 className="font-cairo font-extrabold text-[27px] sm:text-[32px] leading-tight mb-3">
            قواعد وإرشادات المنصة
          </h1>
          <p className="text-muted leading-7 max-w-[720px]">
            الهدف من هذه القواعد هو الحفاظ على مجتمع محترم، مفيد، وآمن للجميع.
          </p>
        </div>

        <div className="space-y-5">
          {sections.map((section) => (
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
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] sm:text-[16px] leading-7 text-text/90">
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
