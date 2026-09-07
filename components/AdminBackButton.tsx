import Link from 'next/link';

export default function AdminBackButton() {
  return (
    <Link
      href="/admin"
      className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/[0.07] px-4 py-2.5 text-[13px] sm:text-sm font-cairo font-semibold text-gold transition hover:bg-gold/[0.12] hover:border-gold/45"
    >
      <span aria-hidden="true" className="text-base leading-none">→</span>
      <span>العودة إلى لوحة الإدارة</span>
    </Link>
  );
}
