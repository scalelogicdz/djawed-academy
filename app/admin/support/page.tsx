import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';

export default async function AdminSupportPage() {
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

  if (!profile?.is_admin) redirect('/dashboard');

  const { data: requests } = await supabase
    .from('support_requests')
    .select('id, name, email, subject, message, status, created_at')
    .order('created_at', { ascending: false });

  return (
    <>
      <StudentNav isAdmin currentUserId={user.id} />
      <section className="max-w-[1050px] mx-auto px-5 sm:px-6 py-10 sm:py-14">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <div className="eyebrow">لوحة الإدارة</div>
            <h1 className="font-cairo font-extrabold text-[27px] sm:text-[31px]">طلبات الدعم</h1>
          </div>
          <Link href="/admin" className="text-sm text-muted hover:text-gold transition whitespace-nowrap">
            العودة للإدارة
          </Link>
        </div>

        {!requests?.length ? (
          <div className="card p-8 text-center text-muted">لا توجد طلبات دعم حتى الآن.</div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <article key={request.id} className="card p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h2 className="font-cairo font-bold text-lg">{request.subject}</h2>
                      <span className="text-[11px] px-2.5 py-1 rounded-full border border-gold/30 bg-gold/10 text-gold">
                        {request.status === 'new' ? 'جديد' : request.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted">{request.name}</p>
                  </div>
                  <time className="text-xs text-muted2 whitespace-nowrap">
                    {new Date(request.created_at).toLocaleString('ar-DZ')}
                  </time>
                </div>

                <div className="rounded-xl border border-border bg-[#101722] p-4 mb-4">
                  <p className="text-sm sm:text-[14.5px] leading-7 whitespace-pre-wrap">{request.message}</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <span className="text-xs text-muted2">البريد الإلكتروني</span>
                  <a
                    href={`mailto:${request.email}`}
                    dir="ltr"
                    className="text-sm text-gold hover:underline break-all"
                  >
                    {request.email}
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
