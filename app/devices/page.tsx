'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Browser={id:string;label:string;created_at:string;last_seen_at:string;current:boolean};
type DeviceState={allowed:boolean;disabled:boolean;nextAt:string|null;browsers:Browser[]};
export default function DevicesPage(){
  const [state,setState]=useState<DeviceState|null>(null);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [target,setTarget]=useState('');const [challenge,setChallenge]=useState('');const [code,setCode]=useState('');
  async function load(){try{const r=await fetch('/api/account-devices',{cache:'no-store'});const d=await r.json();if(r.status===401){window.location.assign('/login');return;}if(!r.ok)throw new Error(d.error);setState(d);}catch(e){setError(e instanceof Error?e.message:'تعذّر تحميل الأجهزة');}}
  useEffect(()=>{void load();},[]);
  async function submit(action:'request'|'confirm'){
    setBusy(true);setError('');try{const r=await fetch('/api/account-devices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,targetId:target,challengeId:challenge,code})});const d=await r.json();if(!r.ok)throw new Error(d.error);if(action==='request'){setChallenge(d.challengeId);setCode('');}else window.location.assign('/dashboard');}catch(e){setError(e instanceof Error?e.message:'تعذّر إكمال الطلب');}finally{setBusy(false);}
  }
  const cooldown=state?.nextAt&&Date.parse(state.nextAt)>Date.now();
  return <section className="max-w-[620px] mx-auto px-5 py-10 sm:py-16" dir="rtl">
    <img src="/djawed-logic-logo.png" alt="Djawed Logic" className="h-14 w-auto mx-auto mb-7"/>
    <h1 className="font-cairo font-extrabold text-2xl mb-3">المتصفحات المسجّلة</h1>
    <p className="text-muted mb-6">يمكن استعمال الحساب على متصفحين فقط. تغيير المتصفح أو حذف ملفات الارتباط قد يجعله يُحسب كمتصفح جديد.</p>
    {error&&<p role="alert" className="text-red-400 mb-4">{error}</p>}
    {!state&&<button className="btn-ghost" onClick={load}>إعادة التحميل</button>}
    {state&&!state.allowed&&<p className="card p-4 mb-5">وصل حسابك إلى حد المتصفحات المسموح بها، أو تم استبدال هذا المتصفح سابقًا. اختر متصفحًا قديمًا لاستبداله، ثم أكّد عبر بريد حسابك.</p>}
    <div className="space-y-3">{state?.browsers.map(b=><label key={b.id} className="card p-4 flex gap-3 items-center">
      {!state.allowed&&<input type="radio" name="browser" value={b.id} checked={target===b.id} disabled={busy||!!challenge||!!cooldown} onChange={()=>setTarget(b.id)}/>}
      <span className="flex-1"><span className="block font-semibold" dir="ltr">{b.label}</span><span className="text-xs text-muted">آخر استعمال: {new Date(b.last_seen_at).toLocaleString('ar-DZ')}</span></span>
      {b.current&&<span className="text-gold text-xs">هذا المتصفح</span>}
    </label>)}</div>
    {cooldown&&<p className="text-muted mt-5">يمكنك الاستبدال مجددًا في {new Date(state!.nextAt!).toLocaleString('ar-DZ')}.</p>}
    {state&&!state.allowed&&!challenge&&<button className="btn-primary w-full mt-5" disabled={busy||!target||!!cooldown} onClick={()=>submit('request')}>{busy?'جارٍ الإرسال...':'إرسال رمز التحقق إلى بريدي'}</button>}
    {challenge&&<form className="card p-5 mt-5" onSubmit={e=>{e.preventDefault();void submit('confirm');}}>
      <label className="block mb-2" htmlFor="verification-code">أدخل رمز التحقق الذي أرسلناه إلى بريد حسابك</label>
      <input id="verification-code" className="w-full border border-border bg-transparent rounded-lg p-3 text-center tracking-widest" dir="ltr" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/>
      <p className="text-xs text-muted mt-3">صالح لمدة 10 دقائق و5 محاولات. بعد التأكيد، يتوقف المتصفح القديم ويبدأ انتظار 7 أيام قبل الاستبدال التالي.</p>
      <button className="btn-primary w-full mt-4" disabled={busy}>{busy?'جارٍ التحقق...':'تأكيد الاستبدال والدخول'}</button>
      <button type="button" className="btn-ghost w-full mt-3" disabled={busy} onClick={()=>{setChallenge('');setCode('');}}>طلب رمز جديد أو تغيير المتصفح المختار</button>
    </form>}
    {state?.allowed&&<Link href="/dashboard" className="btn-primary mt-6 inline-flex">العودة إلى المنصة</Link>}
    <button className="btn-ghost mt-6 block" onClick={async()=>{await createClient().auth.signOut({scope:'local'});window.location.assign('/login');}}>تسجيل الخروج من هذا المتصفح</button>
  </section>;
}
