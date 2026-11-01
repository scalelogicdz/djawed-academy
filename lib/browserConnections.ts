import { createAdminClient } from '@/lib/supabase/admin';
export const ACTIVE_BROWSER_WINDOW_MS = 90_000;
export type ActiveBrowser = { id: string; label: string; lastSeenAt: string; path: string };
export async function activeBrowserConnections(now=Date.now()) {
  const db=createAdminClient();
  const result:Record<string,ActiveBrowser[]>={};
  const cutoff=new Date(now-ACTIVE_BROWSER_WINDOW_MS).toISOString();
  for(let offset=0;;offset+=500){
    const {data,error}=await db.from('browser_connections')
      .select('id,user_id,label,last_seen_at,last_seen_path').gte('last_seen_at',cutoff)
      .order('user_id').order('id').range(offset,offset+499);
    if(error)throw new Error('Browser presence unavailable');
    for(const row of data||[]){
      const list=result[row.user_id]??=[];
      list.push({id:row.id,label:row.label,lastSeenAt:row.last_seen_at,path:row.last_seen_path});
      result[row.user_id]=list;
    }
    if((data||[]).length<500)break;
  }
  return result;
}
