import { NextResponse, type NextRequest } from 'next/server';

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

/**
 * Add CORS headers to response
 */
function addCorsHeaders(
  response: NextResponse,
  origin: string | null,
  requestOrigin: string,
): NextResponse {
  const isAllowedOrigin = origin !== null
    && (origin === requestOrigin || allowedOrigins.has(origin));

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  const requestOrigin = request.nextUrl.origin;

  // Handle CORS preflight requests for API routes
  if (isApiRoute && request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    return addCorsHeaders(response, origin, requestOrigin);
  }

  const response = NextResponse.next({ request });

  if (isApiRoute) {
    return addCorsHeaders(response, origin, requestOrigin);
  }

  return response;
}


export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
