import { createAdminClient } from '@/lib/supabase/admin';

// Cumulative distinct browsers since tracking began; not current online sessions.
export async function browserConnectionCounts() {
  const db=createAdminClient();
  const counts:Record<string,number>={};
  for(let offset=0;;offset+=500){
    const {data,error}=await db.rpc('browser_connection_counts').order('user_id').range(offset,offset+499);
    if(error)throw new Error('Browser counts unavailable');
    for(const row of data||[])counts[row.user_id]=Number(row.browser_count);
    if((data||[]).length<500)break;
  }
  return counts;
}
