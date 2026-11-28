import { createHmac } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export async function persistentRateLimit(bucket: string, identity: string, limit: number, windowSeconds: number) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Security checks unavailable');
  const key = createHmac('sha256', secret).update(bucket + ':' + identity).digest('hex');
  const { data, error } = await createAdminClient().rpc('take_security_rate_limit', {
    p_bucket: bucket, p_key: key, p_limit: limit, p_window_seconds: windowSeconds,
  });
  if (error || typeof data?.allowed !== 'boolean' || !Number.isFinite(data.retry_after)) throw new Error('Security checks unavailable');
  return { allowed: data.allowed as boolean, retryAfterSeconds: Math.max(1, Math.ceil(data.retry_after)) };
}
