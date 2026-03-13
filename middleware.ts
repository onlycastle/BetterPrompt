import { NextResponse, type NextRequest } from 'next/server';

const configuredBaseUrl = process.env.BETTERPROMPT_BASE_URL;
const configuredOrigin = configuredBaseUrl ? new URL(configuredBaseUrl).origin : null;

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  ...(configuredOrigin ? [configuredOrigin] : []),
];

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  const isAllowedOrigin = origin && allowedOrigins.some(allowed =>
    origin.startsWith(allowed)
  );

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
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

  // Handle CORS preflight requests for API routes
  if (isApiRoute && request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    return addCorsHeaders(response, origin);
  }

  const response = NextResponse.next({ request });

  if (isApiRoute) {
    return addCorsHeaders(response, origin);
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
