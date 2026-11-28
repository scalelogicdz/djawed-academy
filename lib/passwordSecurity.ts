import { createHash } from 'node:crypto';

export async function validateNewPassword(password: string) {
  if (password.length < 10 || password.length > 128) return 'استعمل كلمة مرور من 10 إلى 128 حرفاً.';
  // The password and complete hash never leave this server. SHA-1 is used only
  // for the HIBP lookup protocol; Supabase retains responsibility for storage.
  const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const response = await fetch('https://api.pwnedpasswords.com/range/' + hash.slice(0, 5), {
    headers: { 'Add-Padding': 'true', 'User-Agent': 'DjawedLogic-PasswordSecurity' },
    signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error',
  });
  if (!response.ok) throw new Error('Password verification unavailable');
  const text = await response.text();
  if (!text.trim() || !text.split(/\r?\n/).every(line => !line || /^[A-F0-9]{35}:\d+$/.test(line))) throw new Error('Invalid password verification response');
  const leaked = text.split(/\r?\n/).some(line => {
    const [suffix, count] = line.split(':');
    return suffix === hash.slice(5) && Number(count) > 0;
  });
  return leaked ? 'كلمة المرور هذه ظهرت في تسريبات سابقة. اختر كلمة مرور مختلفة.' : null;
}
