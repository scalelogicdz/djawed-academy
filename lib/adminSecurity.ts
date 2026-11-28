import type { SupabaseClient } from '@supabase/supabase-js';

export async function adminSecurityStatus(db: SupabaseClient) {
  const { data, error } = await db.rpc('admin_mfa_status');
  if (error || typeof data?.is_admin !== 'boolean' || typeof data?.required !== 'boolean' || typeof data?.satisfied !== 'boolean') throw new Error('Admin verification unavailable');
  return data as { is_admin: boolean; required: boolean; satisfied: boolean };
}
export async function verifiedAdmin(db: SupabaseClient) {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await db.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return null;
  const status = await adminSecurityStatus(db);
  return status.is_admin && status.satisfied ? user : null;
}
