export type ServiceItemContent = {
  title: string;
  description: string;
  image: string;
};

export type ServicesPageContent = {
  eyebrow: string;
  heading: string;
  intro: string;
  cta: string;
  footerNote: string;
  services: ServiceItemContent[];
};

export type GuidelineSectionContent = {
  number: string;
  title: string;
  items: string[];
};

export type GuidelinesPageContent = {
  eyebrow: string;
  heading: string;
  intro: string;
  sections: GuidelineSectionContent[];
};

export const defaultServicesContent: ServicesPageContent = {
  eyebrow: 'خدماتنا',
  heading: 'خدمات إضافية تساعدك على التقدم بشكل أسرع',
  intro:
    'اختر الخدمة المناسبة حسب احتياجك، سواء كنت تريد تطوير مهاراتك بشكل فردي، مراجعة التسويق والإعلانات، أو بناء متجر إلكتروني جاهز للانطلاق.',
  cta: 'اكتشف الخدمة',
  footerNote: 'قريبًا سيكون لكل خدمة صفحة مستقلة فيها التفاصيل الكاملة وطريقة طلب الخدمة.',
  services: [
    {
      title: 'كوتشينغ فردي 1:1',
      description:
        'جلسات فردية مركزة لمساعدتك على تطوير مهاراتك، حل التحديات، والوصول إلى أهدافك بخطة واضحة.',
      image: '/services/coaching.webp',
    },
    {
      title: 'استشارة التسويق والإعلانات',
      description:
        'جلسة عملية لتحليل وضعك الحالي وبناء اتجاه أوضح للتسويق والإعلانات واتخاذ قرارات أفضل.',
      image: '/services/consultation.webp',
    },
    {
      title: 'إنشاء المتاجر الإلكترونية',
      description:
        'بناء متجر إلكتروني احترافي ومنظم ليكون جاهزًا لعرض منتجاتك والانطلاق في البيع أونلاين.',
      image: '/services/store-building.webp',
    },
  ],
};

export const defaultGuidelinesContent: GuidelinesPageContent = {
  eyebrow: 'المنصة',
  heading: 'قواعد وإرشادات المنصة',
  intro: 'الهدف من هذه القواعد هو الحفاظ على مجتمع محترم، مفيد، وآمن للجميع.',
  sections: [
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
  ],
};

export function getServicesContent(value: unknown): ServicesPageContent {
  if (!value || typeof value !== 'object') return defaultServicesContent;
  const source = value as Partial<ServicesPageContent>;
  const services = Array.isArray(source.services)
    ? defaultServicesContent.services.map((fallback, index) => {
        const item = source.services?.[index] as Partial<ServiceItemContent> | undefined;
        return {
          title: typeof item?.title === 'string' ? item.title : fallback.title,
          description: typeof item?.description === 'string' ? item.description : fallback.description,
          image: fallback.image,
        };
      })
    : defaultServicesContent.services;

  return {
    eyebrow: typeof source.eyebrow === 'string' ? source.eyebrow : defaultServicesContent.eyebrow,
    heading: typeof source.heading === 'string' ? source.heading : defaultServicesContent.heading,
    intro: typeof source.intro === 'string' ? source.intro : defaultServicesContent.intro,
    cta: typeof source.cta === 'string' ? source.cta : defaultServicesContent.cta,
    footerNote: typeof source.footerNote === 'string' ? source.footerNote : defaultServicesContent.footerNote,
    services,
  };
}

export function getGuidelinesContent(value: unknown): GuidelinesPageContent {
  if (!value || typeof value !== 'object') return defaultGuidelinesContent;
  const source = value as Partial<GuidelinesPageContent>;
  const sections = Array.isArray(source.sections)
    ? defaultGuidelinesContent.sections.map((fallback, index) => {
        const section = source.sections?.[index] as Partial<GuidelineSectionContent> | undefined;
        return {
          number: fallback.number,
          title: typeof section?.title === 'string' ? section.title : fallback.title,
          items:
            Array.isArray(section?.items) && section.items.every((item) => typeof item === 'string')
              ? section.items
              : fallback.items,
        };
      })
    : defaultGuidelinesContent.sections;

  return {
    eyebrow: typeof source.eyebrow === 'string' ? source.eyebrow : defaultGuidelinesContent.eyebrow,
    heading: typeof source.heading === 'string' ? source.heading : defaultGuidelinesContent.heading,
    intro: typeof source.intro === 'string' ? source.intro : defaultGuidelinesContent.intro,
    sections,
  };
}
