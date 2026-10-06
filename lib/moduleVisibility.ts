import type { SupabaseClient } from '@supabase/supabase-js';

export const moduleVisibilityKey = (id: string) => `module-visibility:${id}`;

export async function hiddenModuleIds(db: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await db.from('site_content')
    .select('key, content').like('key', 'module-visibility:%');
  // Older installations may not have the optional settings table yet.
  if (error?.code === '42P01') return new Set();
  if (error) throw new Error('Could not load module visibility');
  return new Set((data ?? []).filter(row => row.content?.hidden === true)
    .map(row => row.key.slice('module-visibility:'.length)));
}
