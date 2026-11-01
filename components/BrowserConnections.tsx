'use client';
import {useEffect,useState} from 'react';
import type {ActiveBrowser} from '@/lib/browserConnections';
export function useBrowserConnections(){
  const [connections,setConnections]=useState<Record<string,ActiveBrowser[]>>({});
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  useEffect(()=>{
    let active=true,pending=false;
    async function load(){
      if(pending||document.visibilityState==='hidden')return;pending=true;
      try{
        const response=await fetch('/api/admin/browser-connections',{cache:'no-store',signal:AbortSignal.timeout(8000)});
        const data=await response.json();
        if(!response.ok)throw new Error('unavailable');
        if(active){setConnections(data.connections);setStatus('ready');}
      }catch{if(active)setStatus('error');}finally{pending=false;}
    }
    void load();const timer=window.setInterval(load,10000);
    document.addEventListener('visibilitychange',load);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',load);};
  },[]);
  return {connections,status};
}
export function BrowserConnectionBadge({browsers,status}:{browsers:ActiveBrowser[];status:'loading'|'ready'|'error'}){
  if(status!=='ready')return <span className="text-xs text-muted">{status==='loading'?'جارٍ التحميل...':'تعذّر تحميل المتصفحات'}</span>;
  if(!browsers.length)return <span className="text-xs text-muted">0 متصفح نشط</span>;
  return <details className="text-xs">
    <summary className={`cursor-pointer font-semibold ${browsers.length>1?'text-amber-300':'text-success'}`}>{browsers.length} متصفح نشط {browsers.length>1?'· مراجعة النشاط':''}</summary>
    <ul className="mt-3 space-y-3 min-w-[180px]">{browsers.map(b=><li key={b.id} className="border-b border-border pb-2 last:border-0">
      <span className="block text-text" dir="ltr">{b.label}</span>
      <span className="block text-muted mt-1">آخر نشاط: {new Date(b.lastSeenAt).toLocaleTimeString('ar-DZ')}</span>
      <span className="block text-muted break-all" dir="ltr">{b.path}</span>
    </li>)}</ul>
  </details>;
}
