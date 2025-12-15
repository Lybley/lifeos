import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Custom authentication middleware
export function middleware(request: NextRequest) {
  // Get the pathname
  const { pathname } = request.nextUrl;

  // Protected routes
  const protectedRoutes = [
    '/dashboard',
    '/chat',
    '/memory',
    '/upload',
    '/connections',
    '/actions',
    '/billing',
    '/settings',
    '/admin',
  ];

  // Check if the current path is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    // Check for auth cookie or allow access (for now, we're using client-side auth)
    // In production, you would check for a valid session token here
    const authCookie = request.cookies.get('lifeos_auth');
    
    // For now, allow all access since we're using localStorage auth
    // TODO: Implement proper cookie-based authentication
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/chat/:path*',
    '/memory/:path*',
    '/upload/:path*',
    '/connections/:path*',
    '/actions/:path*',
    '/billing/:path*',
    '/settings/:path*',
    '/admin/:path*',
  ],
};
