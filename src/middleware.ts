import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

function injectTokenFromHeader(request: NextRequest): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  const hasCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token'));
  if (hasCookie) return;
  request.cookies.set(`sb-${getProjectRef()}-auth-token`, token);
}

export async function middleware(request: NextRequest) {
  injectTokenFromHeader(request);
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedRoutes = [
    '/student-dashboard',
    '/new-session',
    '/student-analysis-history',
    '/admin-portal',
    '/student-parent-dashboard',
    '/group-video-session',
    '/settings',
    '/counselor-dashboard',
    '/counselor-mentor-analytics',
    '/counselor-student-view',
    '/school-dashboard',
    '/school-student-view',
    '/school-mentor-view',
  ];

  const isProtected = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-up-login-screen';
    return NextResponse.redirect(url);
  }

  // If logged in and on login page, redirect based on role
  if (user && request.nextUrl.pathname === '/sign-up-login-screen') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'mentor';
    const url = request.nextUrl.clone();
    if (role === 'student_parent') {
      url.pathname = '/student-parent-dashboard';
    } else if (role === 'counselor') {
      url.pathname = '/counselor-dashboard';
    } else if (role === 'school') {
      url.pathname = '/school-dashboard';
    } else {
      url.pathname = '/student-dashboard';
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
