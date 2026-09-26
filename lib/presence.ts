import 'server-only';

import { createHmac } from 'node:crypto';

export function presenceKeyForUser(userId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for presence keys');

  return createHmac('sha256', secret)
    .update(`academy-presence:${userId}`)
    .digest('hex')
    .slice(0, 40);
}
