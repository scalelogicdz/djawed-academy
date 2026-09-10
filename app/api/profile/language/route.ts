import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

  const payload = await request.json();
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
