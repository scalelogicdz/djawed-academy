import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { activeBrowserConnections } from '@/lib/browserConnections';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
  const client=await createClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user)return json({error:'غير مصرح'},401);
  const {data:profile}=await client.from('profiles').select('is_admin').eq('id',user.id).single();
  if(!profile?.is_admin)return json({error:'غير مصرح'},403);
  try{return json({connections:await activeBrowserConnections(),asOf:new Date().toISOString(),windowSeconds:90});}
  catch{return json({error:'تعذّر تحميل المتصفحات النشطة. تحقق من إعداد قاعدة البيانات.'},503);}
}
