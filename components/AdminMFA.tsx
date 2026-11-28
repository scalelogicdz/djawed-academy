'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function AdminMFA({ enrolled, satisfied }: { enrolled:boolean; satisfied:boolean }) {
  const [client] = useState(()=>createClient());
  const [factorId,setFactorId]=useState(''); const [qr,setQr]=useState('');
  const [code,setCode]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  useEffect(()=>{if(!enrolled)return;let active=true;client.auth.mfa.listFactors().then(({data,error})=>{
    if(!active)return;const factor=data?.totp.find(item=>item.status==='verified');
    if(error||!factor)setError('تعذر تحميل وسيلة التحقق. أعد تحميل الصفحة.');else setFactorId(factor.id);
  });return()=>{active=false;};},[client,enrolled]);
  async function enroll(){
    setBusy(true);setError('');
    try{
      const existing=await client.auth.mfa.listFactors();
      if(existing.error)throw existing.error;
      if(existing.data.totp.some(f=>f.status==='verified')){window.location.reload();return;}
      const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Djawed Logic '+Date.now()});
      if(error)throw error;
      setFactorId(data.id);setQr(data.totp.qr_code);
    }catch{setError('تعذر بدء التفعيل. حاول من جديد.');}finally{setBusy(false);}
  }
  async function verify(event:React.FormEvent){
    event.preventDefault();if(!/^\d{6}$/.test(code)||!factorId)return;
    setBusy(true);setError('');
    try{
      const {error}=await client.auth.mfa.challengeAndVerify({factorId,code});
      if(error)throw error;
      setCode('');setQr('');window.location.assign('/admin');
    }catch{setError('الرمز غير صحيح أو انتهت صلاحيته. جرّب الرمز الحالي.');}finally{setBusy(false);}
  }
  async function cancel(){
    if(!factorId||enrolled)return;
    setBusy(true);const {error}=await client.auth.mfa.unenroll({factorId});
    setBusy(false);if(error){setError('تعذر إلغاء الإعداد.');return;}setFactorId('');setQr('');setCode('');
  }
  return <main className="max-w-[520px] mx-auto px-5 py-12" dir="rtl">
    <section className="card p-6 sm:p-8">
      <h1 className="font-cairo text-2xl font-bold mb-3">حماية حساب الإدارة</h1>
      <p className="text-sm text-muted leading-7 mb-5">{enrolled?'أدخل رمز تطبيق المصادقة للدخول إلى الإدارة.':'اربط حسابك بتطبيق مصادقة مثل Google Authenticator، ثم أكّد الرمز لتفعيل الحماية الثنائية.'}</p>
      {enrolled&&satisfied&&<p className="text-gold text-sm mb-4">الحماية الثنائية مفعّلة لهذه الجلسة.</p>}
      {!enrolled&&!factorId&&<button type="button" onClick={enroll} disabled={busy} className="btn-primary w-full">{busy?'جارٍ التحضير…':'إعداد تطبيق المصادقة'}</button>}
      {qr&&<div className="mb-5"><img src={qr} width={240} height={240} alt="رمز إعداد تطبيق المصادقة لحساب الإدارة" className="mx-auto rounded-xl bg-white p-3"/><p className="text-xs text-muted mt-3">امسح الرمز من تطبيق المصادقة على هاتفك. لا تشاركه مع أي شخص.</p></div>}
      {factorId&&<form onSubmit={verify}>
        <label htmlFor="admin-totp" className="block text-sm mb-2">رمز التحقق</label>
        <input id="admin-totp" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} className="w-full border border-border rounded-xl px-4 py-3 text-center text-2xl tracking-[.3em] bg-surface"/>
        <button disabled={busy||code.length!==6} className="btn-primary w-full mt-4">{busy?'جارٍ التحقق…':enrolled?'تأكيد والدخول':'تأكيد وتفعيل الحماية'}</button>
      </form>}
      {error&&<p role="alert" className="text-sm text-red-500 mt-4">{error}</p>}
      {!enrolled&&qr&&<button type="button" className="btn-ghost mt-3" disabled={busy} onClick={cancel}>إلغاء هذا الإعداد</button>}
      {(!enrolled||satisfied)&&<Link href="/admin" className="block mt-5 text-sm text-gold">العودة إلى الإدارة</Link>}
      <button type="button" className="block mt-4 text-xs text-muted" onClick={async()=>{await client.auth.signOut({scope:'local'});window.location.assign('/login');}}>تسجيل الخروج</button>
    </section>
  </main>;
}
