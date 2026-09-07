import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminOverview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { count: studentCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin', false);

  const { count: courseCount } = await supabase.from('courses').select('id', { count: 'exact', head: true });
  const { count: lessonCount } = await supabase.from('lessons').select('id', { count: 'exact', head: true });
  const { count: supportCount } = await supabase.from('support_requests').select('id', { count: 'exact', head: true });

  const stats = [
    { label: 'الطلاب', value: studentCount ?? 0 },
    { label: 'الدورات', value: courseCount ?? 0 },
    { label: 'الدروس', value: lessonCount ?? 0 },
    { label: 'طلبات الدعم', value: supportCount ?? 0 },
  ];

  return (
    <section className="max-w-[1140px] mx-auto px-5 sm:px-6 py-10 sm:py-12">
      <div className="mb-8">
        <div className="eyebrow">لوحة الإدارة</div>
        <h1 className="font-cairo font-extrabold text-[27px] sm:text-[31px] mb-2">نظرة عامة</h1>
        <p className="text-muted text-sm leading-7">إدارة الطلاب والدروس والدعم ومحتوى المنصة من مكان واحد.</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-9">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 sm:p-5">
            <div className="font-mono font-bold text-2xl sm:text-[28px] text-gold mb-1">{s.value}</div>
            <div className="text-[12px] text-muted2">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <h2 className="font-cairo font-extrabold text-[18px]">إدارة المنصة</h2>
        <p className="text-muted2 text-xs mt-1">اختر القسم الذي تريد إدارته.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/admin/students" className="card p-5 sm:p-6 hover:border-gold/30 hover:-translate-y-0.5 transition duration-200">
          <h3 className="font-cairo font-bold text-lg mb-1.5">إدارة الطلاب</h3>
          <p className="text-muted text-sm leading-6">إضافة طالب، منح الوصول للدورات وإدارة التسجيل.</p>
        </Link>
        <Link href="/admin/lessons" className="card p-5 sm:p-6 hover:border-gold/30 hover:-translate-y-0.5 transition duration-200">
          <h3 className="font-cairo font-bold text-lg mb-1.5">إدارة الدروس</h3>
          <p className="text-muted text-sm leading-6">إضافة الوحدات والدروس والاختبارات وإدارة المحتوى التعليمي.</p>
        </Link>
        <Link href="/admin/support" className="card p-5 sm:p-6 hover:border-gold/30 hover:-translate-y-0.5 transition duration-200">
          <h3 className="font-cairo font-bold text-lg mb-1.5">طلبات الدعم</h3>
          <p className="text-muted text-sm leading-6">مراجعة رسائل الطلاب ومتابعة طلبات التواصل.</p>
        </Link>
        <Link href="/admin/site-content" className="card p-5 sm:p-6 hover:border-gold/30 hover:-translate-y-0.5 transition duration-200">
          <h3 className="font-cairo font-bold text-lg mb-1.5">إدارة المحتوى</h3>
          <p className="text-muted text-sm leading-6">تعديل نصوص صفحة الخدمات والقواعد والإرشادات بدون كود.</p>
        </Link>
      </div>
    </section>
  );
}
