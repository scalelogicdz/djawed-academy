import Link from 'next/link';

type Props = {
  title: string;
  description: string;
  image: string;
  whatsappMessage: string;
};

const whatsappNumber = '213551242082';

export default function ServiceComingSoonPage({ title, description, image, whatsappMessage }: Props) {
  const whatsappHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <main className="max-w-[1040px] mx-auto px-5 sm:px-6 py-10 sm:py-14" dir="rtl">
      <div className="mb-6">
        <Link href="/services" className="inline-flex items-center gap-2 text-sm text-muted hover:text-gold transition">
          <span>→</span>
          <span>العودة إلى الخدمات</span>
        </Link>
      </div>

      <section className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#111925] shadow-[0_28px_70px_-34px_rgba(0,0,0,0.9)]">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr] items-stretch">
          <div className="relative min-h-[280px] sm:min-h-[360px] lg:min-h-[520px] bg-[#F6F0E7] overflow-hidden">
            <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080C13]/30 via-transparent to-transparent lg:bg-gradient-to-l" />
          </div>

          <div className="p-6 sm:p-9 lg:p-11 flex flex-col justify-center">
            <div className="inline-flex self-start items-center gap-2 rounded-full border border-gold/30 bg-gold/[0.08] px-3.5 py-2 text-[12px] font-bold text-gold mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_10px_rgba(212,177,94,0.7)]" />
              الخدمة ستكون متاحة قريبًا
            </div>

            <div className="eyebrow mb-3">خدمات Djawed Logic</div>
            <h1 className="font-heading font-extrabold text-[29px] sm:text-[36px] lg:text-[41px] leading-[1.35] mb-5">
              {title}
            </h1>
            <p className="text-muted text-[14px] sm:text-[15.5px] leading-8 mb-7">
              {description}
            </p>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6 mb-7">
              <h2 className="font-cairo font-bold text-[15px] mb-2">حاب تعرف أول ما تفتح الخدمة؟</h2>
              <p className="text-muted text-[13.5px] leading-7">
                راسلني مباشرة عبر واتساب، وسأعرف من أي خدمة تواصلت معي وأعطيك التفاصيل عندما تصبح متاحة.
              </p>
            </div>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="btn-primary w-full sm:w-auto sm:min-w-[240px] text-center font-cairo font-bold text-[15px]"
            >
              تواصل معي عبر واتساب
            </a>

            <p className="text-muted2 text-[11.5px] mt-3">
              سيتم فتح واتساب برسالة جاهزة خاصة بهذه الخدمة.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
