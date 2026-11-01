import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { browserToken, DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS } from '@/lib/accountAccess';

export async function proxy(request: NextRequest) {
  const token=browserToken(request.cookies.get(DEVICE_COOKIE)?.value);
  request.cookies.set(DEVICE_COOKIE,token);
  function finish(result:NextResponse){result.cookies.set(DEVICE_COOKIE,token,DEVICE_COOKIE_OPTIONS);return result;}
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith('/dashboard') ||
    path.startsWith('/course-content') ||
    path.startsWith('/lesson') ||
    path.startsWith('/community') ||
    path.startsWith('/admin');

  if (isProtected && !user) {
    return finish(NextResponse.redirect(new URL('/login', request.url)));
  }

  if (path.startsWith('/login') && user) {
    return finish(NextResponse.redirect(new URL('/dashboard', request.url)));
  }

  if (path.startsWith('/admin') && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return finish(NextResponse.redirect(new URL('/dashboard', request.url)));
    }
  }

  return finish(response);
}

export const config = {
  matcher: ['/dashboard/:path*', '/course-content/:path*', '/lesson/:path*', '/community/:path*', '/admin/:path*', '/login'],
};

