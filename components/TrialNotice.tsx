import Link from 'next/link';
export default function TrialNotice({ expiresAt, expired = false }: { expiresAt: string | null; expired?: boolean }) {
  return <aside dir="rtl" className="card border-gold/30 bg-gold/5 p-5 mb-6" role="note">
    <h2 className="font-cairo font-bold text-gold mb-2">{expired ? 'انتهت الفترة التجريبية' : 'وصول تجريبي — الوحدة الأولى فقط'}</h2>
    <p className="text-sm leading-7 text-muted">راك في النسخة التجريبية. فعّل الوصول الكامل باش تشوف كامل الدروس وتستافد من جميع مزايا المنصّة.</p>
    {expiresAt && <p className="text-xs leading-6 text-muted mt-2">يُحذف الحساب التجريبي تلقائياً يوم {new Intl.DateTimeFormat('ar-DZ', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Algiers' }).format(new Date(expiresAt))} بتوقيت الجزائر، إلا إذا تم تفعيل الوصول الكامل.</p>}
    <Link href="https://course.djawedkhalfaoui.com/#pricing" className="btn-primary inline-flex mt-4">فعّل الوصول الكامل</Link>
  </aside>;
}
