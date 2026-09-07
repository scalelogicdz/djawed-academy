import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_DISPLAY_NAME = 50;
const MAX_BIO = 240;
const MAX_URL = 300;

function cleanOptional(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function validSocialUrl(value: string | null) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const payload = await request.json();
  const displayName = typeof payload.display_name === 'string' ? payload.display_name.trim() : '';
  const bio = cleanOptional(payload.bio, MAX_BIO);
  const instagramUrl = cleanOptional(payload.instagram_url, MAX_URL);
  const facebookUrl = cleanOptional(payload.facebook_url, MAX_URL);
  const tiktokUrl = cleanOptional(payload.tiktok_url, MAX_URL);
  const linkedinUrl = cleanOptional(payload.linkedin_url, MAX_URL);

  if (displayName.length < 2 || displayName.length > MAX_DISPLAY_NAME) {
    return NextResponse.json({ error: 'الاسم يجب أن يكون بين حرفين و50 حرفًا' }, { status: 400 });
  }

  const links = [instagramUrl, facebookUrl, tiktokUrl, linkedinUrl];
  if (links.some((link) => !validSocialUrl(link))) {
    return NextResponse.json({ error: 'تأكد أن روابط التواصل تبدأ بـ http:// أو https://' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('profiles')
    .update({
      display_name: displayName,
      bio,
      instagram_url: instagramUrl,
      facebook_url: facebookUrl,
      tiktok_url: tiktokUrl,
      linkedin_url: linkedinUrl,
    })
    .eq('id', user.id)
    .select('id, display_name, bio, instagram_url, facebook_url, tiktok_url, linkedin_url, is_admin')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, profile: data });
}
