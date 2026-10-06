import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StudentNav from '@/components/StudentNav';
import AdminSidebar from '@/components/AdminSidebar';

export default async function AdminLayout({ children }: { children: ReactNode }) {
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

  return (
    <>
      <StudentNav isAdmin currentUserId={user.id} />

      <div className="max-w-[1440px] mx-auto lg:px-6 lg:py-6">
        <div className="lg:flex lg:items-start lg:gap-6">
          <AdminSidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </>
  );
}
