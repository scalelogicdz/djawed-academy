import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';

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
  const { count: questionCount } = await supabase.from('questions').select('id', { count: 'exact', head: true });
  const { count: supportCount } = await supabase.from('support_requests').select('id', { count: 'exact', head: true });

  const stats = [
    { label: 'الطلاب', value: studentCount ?? 0 },
    { label: 'الدورات', value: courseCount ?? 0 },
    { label: 'الدروس', value: lessonCount ?? 0 },
    { label: 'طلبات الدعم', value: supportCount ?? 0 },
  ];

  return (
    <>
      <StudentNav isAdmin currentUserId={user.id} />
      <section className="max-w-[1140px] mx-auto px-6 py-14">
        <div className="eyebrow">لوحة الإدارة</div>
        <h1 className="font-cairo font-extrabold text-[26px] mb-8">نظرة عامة</h1>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {stats.map((s) => (
            <div key={s.label} className="card p-5 text-center">
              <div className="font-mono font-bold text-2xl text-gold">{s.value}</div>
              <div className="text-[11.5px] text-muted2 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Link href="/admin/students" className="card p-6 hover:border-goldDim transition">
            <h3 className="font-bold text-lg mb-1.5">إدارة الطلاب</h3>
            <p className="text-muted text-sm">إضافة طالب، منح الوصول للدورة، إزالة الوصول</p>
          </Link>
          <Link href="/admin/lessons" className="card p-6 hover:border-goldDim transition">
            <h3 className="font-bold text-lg mb-1.5">إدارة الدروس</h3>
            <p className="text-muted text-sm">إضافة وحدات ودروس، رفع الفيديو والملفات</p>
          </Link>
          <Link href="/admin/support" className="card p-6 hover:border-goldDim transition">
            <h3 className="font-bold text-lg mb-1.5">طلبات الدعم</h3>
            <p className="text-muted text-sm">مراجعة رسائل الطلاب والتواصل معهم عبر البريد الإلكتروني</p>
          </Link>
        </div>
      </section>
    </>
  );
}
