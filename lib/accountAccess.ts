import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export const DEVICE_COOKIE = 'djawed-browser-v1';
export const DEVICE_COOKIE_OPTIONS = {
  httpOnly: true, secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const, path: '/', maxAge: 365 * 24 * 60 * 60,
};
export const DEVICE_LIMIT_MESSAGE = 'هذا الحساب مسجّل على متصفحين بالفعل. لاستعمال هذا المتصفح، استبدل متصفحًا قديمًا بعد التحقق من بريدك الإلكتروني.';
export const VIEWING_STOP_MESSAGE = 'توقفت المشاهدة لأن الدرس فُتح في جلسة أخرى على حسابك. يمكنك المتابعة هنا لإيقاف الجلسة الأخرى.';
export function browserToken(value?: string) {
  return value && /^[a-f0-9]{64}$/.test(value) ? value : randomBytes(32).toString('hex');
}
export function tokenHash(value: string) { return createHash('sha256').update(value).digest('hex'); }
export function verificationHash(id: string, code: string) {
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(`device-replacement:${id}:${code}`).digest('hex');
}
export function browserLabel(ua: string) {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'متصفح';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ');
}
// Only inspect the session claim AFTER getUser has validated the JWT with Auth.
export async function verifiedIdentity(client: SupabaseClient) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const { data: { session } } = await client.auth.getSession();
  if (!session) return null;
  try {
    const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString());
    if (claims.sub !== user.id || typeof claims.session_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(claims.session_id)) return null;
    return { user, sessionId: claims.session_id as string };
  } catch { return null; }
}
export async function registerBrowser(userId: string, sessionId: string, token: string, ua: string) {
  const { data, error } = await createAdminClient().rpc('register_account_browser', {
    p_user: userId, p_session: sessionId, p_hash: tokenHash(token), p_label: browserLabel(ua),
  });
  if (error || !data) throw new Error('Account access service unavailable');
  return data as { allowed: boolean; disabled?: boolean; reason?: string; browserId?: string };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin && request.headers.get('sec-fetch-site') !== 'cross-site';
}
