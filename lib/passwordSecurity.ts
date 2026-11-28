// Passwords follow the platform owner's six-character minimum policy.
// No external leaked-password screening is performed.
export async function validateNewPassword(password: string) {
  if (password.length < 6 || password.length > 128) return 'استعمل كلمة مرور من 6 إلى 128 حرفاً.';
  return null;
}
