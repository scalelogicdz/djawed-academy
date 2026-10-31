'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useViewingSession(lessonId:string){
  const [url,setUrl]=useState<string|null>(null);
  const [error,setError]=useState('');const [starting,setStarting]=useState(false);
  const lease=useRef<string|null>(null);const generation=useRef(0);const startingRef=useRef(false);
  function release(id:string){
    void fetch('/api/viewing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'stop',lessonId,leaseId:id}),keepalive:true}).catch(()=>{});
  }
  const stop=useCallback((message='')=>{
    generation.current++;const old=lease.current;lease.current=null;setUrl(null);setError(message);
    if(old)release(old);
  },[lessonId]);
  const start=useCallback(async()=>{
    if(startingRef.current)return;
    startingRef.current=true;setStarting(true);setError('');
    const run=++generation.current;
    try{
      const r=await fetch('/api/viewing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',lessonId}),signal:AbortSignal.timeout(10000)});
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'تعذّر بدء المشاهدة');
      if(run!==generation.current){if(data.leaseId)release(data.leaseId);return;}
      lease.current=data.leaseId;setUrl(data.url);
    }catch(e){if(run===generation.current)setError(e instanceof Error&&e.name!=='TimeoutError'?e.message:'تعذّر الاتصال. حاول مجددًا.');}
    finally{startingRef.current=false;setStarting(false);}
  },[lessonId]);
  useEffect(()=>{
    if(!url||!lease.current)return;
    const id=lease.current;let cancelled=false,pending=false,lastCheck=Date.now();
    async function heartbeat(){
      if(cancelled||pending)return;pending=true;
      try{
        const r=await fetch('/api/viewing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'heartbeat',lessonId,leaseId:id}),signal:AbortSignal.timeout(7000),cache:'no-store'});
        const data=await r.json();
        if(cancelled||lease.current!==id)return;
        if(!r.ok){stop(data.error||'توقفت جلسة المشاهدة.');return;}
        lastCheck=Date.now();
      }catch{if(!cancelled&&lease.current===id)stop('توقفت المشاهدة لتعذّر التحقق من الاتصال. أعد المحاولة.');}
      finally{pending=false;}
    }
    function visibility(){if(document.visibilityState==='hidden')stop('توقفت المشاهدة أثناء وجود الصفحة في الخلفية. اضغط للمتابعة.');else void heartbeat();}
    const timer=window.setInterval(heartbeat,5000);
    const watchdog=window.setInterval(()=>{if(Date.now()-lastCheck>15000)stop('انقطع التحقق من الجلسة. اضغط للمتابعة.');},1000);
    function leave(){stop();}
    document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',leave);
    return()=>{cancelled=true;window.clearInterval(timer);window.clearInterval(watchdog);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);};
  },[url,lessonId,stop]);
  useEffect(()=>()=>{generation.current++;const id=lease.current;lease.current=null;if(id)release(id);},[lessonId]);
  return {url,error,starting,start};
}
