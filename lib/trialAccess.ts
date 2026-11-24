import type { SupabaseClient } from '@supabase/supabase-js';

export type PlatformAccess = { mode: 'full' | 'trial' | 'expired'; moduleId: string | null; expiresAt: string | null };
export function resolvePlatformAccess(profile: Record<string, any>, now = Date.now()): PlatformAccess {
  if (profile.is_admin || profile.access_mode !== 'trial') return { mode: 'full', moduleId: null, expiresAt: null };
  const expires = Date.parse(profile.trial_expires_at ?? '');
  return { mode: Number.isFinite(expires) && expires > now && profile.trial_module_id ? 'trial' : 'expired',
    moduleId: profile.trial_module_id ?? null, expiresAt: profile.trial_expires_at ?? null };
}
export async function getPlatformAccess(db: SupabaseClient, userId: string): Promise<PlatformAccess> {
  // SELECT * allows existing full accounts to keep working before the migration.
  // A trial can only be created through the migration's service-only RPC.
  const { data, error } = await db.from('profiles').select('*').eq('id', userId).single();
  if (error || !data) throw new Error('Access verification unavailable');
  const access = resolvePlatformAccess(data);
  if (access.mode === 'trial') {
    // Module RLS also requires a current enrollment. Removing enrollment revokes
    // the preview, even if the profile's original trial date has not elapsed.
    const {data:module,error:moduleError}=await db.from('modules').select('id').eq('id',access.moduleId!).maybeSingle();
    if(moduleError)throw new Error('Enrollment verification unavailable');
    if(!module)return {...access,mode:'expired'};
  }
  return access;
}
export function trialCanViewModule(access: PlatformAccess, moduleId: string) {
  return access.mode === 'full' || (access.mode === 'trial' && access.moduleId === moduleId);
}
