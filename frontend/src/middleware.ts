import { withMiddlewareAuthRequired } from '@auth0/nextjs-auth0/edge';

// Protect these routes with authentication
export default withMiddlewareAuthRequired();

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
