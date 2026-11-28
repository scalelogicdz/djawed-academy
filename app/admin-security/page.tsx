import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { adminSecurityStatus } from '@/lib/adminSecurity';
import AdminMFA from '@/components/AdminMFA';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function AdminSecurityPage(){
  const db=await createClient();const {data:{user}}=await db.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await db.from('profiles').select('is_admin').eq('id',user.id).single();
  if(!profile?.is_admin)redirect('/dashboard');
  const status=await adminSecurityStatus(db);
  if(!status.is_admin)redirect('/dashboard');
  return <AdminMFA enrolled={status.required} satisfied={status.satisfied}/>;
}
