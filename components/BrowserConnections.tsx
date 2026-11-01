'use client';
import {useEffect,useState} from 'react';
export function useBrowserConnections(){
  const [connections,setConnections]=useState<Record<string,number>>({});
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  useEffect(()=>{
    let active=true,pending=false;
    async function load(){
      if(pending||document.visibilityState==='hidden')return;pending=true;
      try{
        const response=await fetch('/api/admin/browser-connections',{cache:'no-store',signal:AbortSignal.timeout(8000)});
        const data=await response.json();
        if(!response.ok)throw new Error('unavailable');
        if(active){setConnections(data.counts);setStatus('ready');}
      }catch{if(active)setStatus('error');}finally{pending=false;}
    }
    void load();const timer=window.setInterval(load,10000);
    document.addEventListener('visibilitychange',load);
    return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',load);};
  },[]);
  return {connections,status};
}
export function BrowserConnectionBadge({count,status}:{count:number;status:'loading'|'ready'|'error'}){
  if(status!=='ready')return <span className="text-xs text-muted" aria-label={status==='loading'?'جارٍ تحميل العدد':'تعذّر تحميل العدد'}>—</span>;
  return <span className="font-mono font-semibold tabular-nums" aria-label={`إجمالي المتصفحات المستخدمة: ${count}`}>{count}</span>;
}
