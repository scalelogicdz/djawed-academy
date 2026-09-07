import LoadingSpinner from '@/components/LoadingSpinner';

export default function Loading() {
  return (
    <div className="delayed-page-loading fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0D14]/70 backdrop-blur-[2px]">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-[#151E2C] px-5 py-4 shadow-2xl">
        <LoadingSpinner size={22} className="text-gold" />
        <span className="font-cairo text-sm font-semibold text-text">جارٍ التحميل...</span>
      </div>
    </div>
  );
}
