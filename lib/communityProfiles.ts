import type { SupabaseClient } from '@supabase/supabase-js';
export type CommunityProfile = {id:string;display_name:string;is_admin:boolean;bio:string|null;avatar_url:string|null;instagram_url:string|null;facebook_url:string|null;tiktok_url:string|null;linkedin_url:string|null};
export async function communityProfiles(db:SupabaseClient,ids:string[]) {
  if(!ids.length)return [] as CommunityProfile[];
  const unique=[...new Set(ids)]; const rows:CommunityProfile[]=[];
  for(let i=0;i<unique.length;i+=100){
    const {data,error}=await db.rpc('community_member_profiles',{p_ids:unique.slice(i,i+100)});
    if(error)throw new Error('Community profiles unavailable');
    rows.push(...(data??[]));
  }
  return rows;
}
