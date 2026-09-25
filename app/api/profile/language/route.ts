import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, readJsonObject } from '@/lib/security';

const supportedLanguages = new Set(['ar', 'fr', 'en']);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ language: 'ar' });

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('profiles')
    .select('preferred_language')
    .eq('id', user.id)
    .single();

  if (error) return NextResponse.json({ language: 'ar' });

  const language = supportedLanguages.has(data?.preferred_language) ? data.preferred_language : 'ar';
  return NextResponse.json({ language });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rate = checkRateLimit(`language-update:${user.id}`, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const payload = await readJsonObject(request, 4 * 1024);
  if (!payload) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const language = typeof payload.language === 'string' ? payload.language : '';

  if (!supportedLanguages.has(language)) {
    return NextResponse.json({ error: 'Invalid language' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('profiles')
    .update({ preferred_language: language })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, language });
}
