import Link from 'next/link';

type Props = {
  title: string;
  description: string;
  image: string;
  whatsappMessage: string;
};

const whatsappNumber = '213551242082';

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="w-5 h-5 fill-current">
      <path d="M19.11 17.54c-.29-.15-1.72-.85-1.99-.95-.27-.1-.46-.15-.66.15-.2.29-.76.95-.93 1.15-.17.2-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.44-.87-.77-1.45-1.72-1.62-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.59-.9-2.18-.24-.57-.48-.49-.66-.5h-.56c-.2 0-.51.07-.78.37-.27.29-1.03 1-1.03 2.45s1.06 2.84 1.2 3.04c.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.71.22 1.35.19 1.86.12.57-.08 1.72-.7 1.96-1.37.24-.67.24-1.25.17-1.37-.07-.12-.27-.2-.56-.34Z" />
      <path d="M16.03 3.2A12.72 12.72 0 0 0 5.15 22.53L3.2 28.8l6.43-1.89a12.76 12.76 0 1 0 6.4-23.71Zm0 23.17a10.38 10.38 0 0 1-5.29-1.45l-.38-.23-3.82 1.12 1.02-3.73-.25-.39a10.4 10.4 0 1 1 8.72 4.68Z" />
    </svg>
  );
}

export default function ServiceComingSoonPage({ title, description, whatsappMessage }: Props) {
  const whatsappHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <main className="max-w-[860px] mx-auto px-5 sm:px-6 py-10 sm:py-14" dir="rtl">
      <div className="mb-6">
        <Link href="/services" className="inline-flex items-center gap-2 text-sm text-muted hover:text-gold transition">
          <span>→</span>
          <span>العودة إلى الخدمات</span>
        </Link>
      </div>

      <section className="rounded-[26px] border border-white/[0.08] bg-[#111925] shadow-[0_28px_70px_-34px_rgba(0,0,0,0.9)] p-6 sm:p-9 lg:p-11">
        <div className="inline-flex self-start items-center gap-2 rounded-full border border-[#E4756A]/35 bg-[#E4756A]/[0.08] px-3.5 py-2 text-[12px] font-bold text-[#F0A49C] mb-5">
          <span className="w-2 h-2 rounded-full bg-[#E4756A]" />
          الخدمة غير متاحة حاليًا
        </div>

        <div className="eyebrow mb-3">خدمات Djawed Logic</div>
        <h1 className="font-heading font-extrabold text-[29px] sm:text-[36px] lg:text-[41px] leading-[1.35] mb-5">
          {title}
        </h1>
        <p className="text-muted text-[14px] sm:text-[15.5px] leading-8 mb-6 max-w-[680px]">
          {description}
        </p>

        <div className="rounded-2xl border border-gold/20 bg-gold/[0.045] p-5 sm:p-6 mb-7">
          <h2 className="font-cairo font-bold text-[17px] sm:text-[18px] mb-2">هذه الخدمة لم تُفتح بعد</h2>
          <p className="text-muted text-[13.5px] leading-7">
            يمكنك التواصل الآن إذا أردت الاستفسار عنها أو تسجيل اهتمامك قبل إطلاقها.
          </p>
        </div>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex w-full sm:w-auto sm:min-w-[280px] items-center justify-center gap-3 rounded-xl border border-[#25D366]/35 bg-[#25D366] px-6 py-3.5 text-[15px] font-bold font-cairo text-[#07120B] shadow-[0_14px_30px_-18px_rgba(37,211,102,0.7)] transition duration-200 hover:brightness-105 hover:-translate-y-0.5"
        >
          <WhatsAppIcon />
          <span>تواصل عبر واتساب</span>
        </a>
      </section>
    </main>
  );
}
