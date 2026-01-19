/**
 * Next.js Middleware for Supabase Auth & CORS
 *
 * This middleware:
 * 1. Handles CORS for API routes (required for Electron desktop app)
 * 2. Refreshes expired auth tokens on every request
 * 3. Syncs cookies between request and response
 * 4. Ensures Server Components receive fresh auth state
 *
 * Required for SSR authentication with Supabase.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', // Vite dev server
  'https://www.nomoreaislop.xyz',
  'https://nomoreaislop.xyz',
  'app://-', // Electron app protocol
];

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: NextResponse, origin: string | null): NextResponse {
  // Allow requests from Electron apps (they send 'null' or no origin)
  // and from allowed origins
  const isAllowed = !origin || origin === 'null' || allowedOrigins.some(allowed =>
    origin.startsWith(allowed) || allowed === 'app://-' && origin.startsWith('app://')
  );

  if (isAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
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

  // Create initial response
  let supabaseResponse = NextResponse.next({ request });

  // Add CORS headers for API routes
  if (isApiRoute) {
    supabaseResponse = addCorsHeaders(supabaseResponse, origin);
  }

  // Skip auth for API routes and when Supabase is not configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase not configured, skip auth middleware
    return supabaseResponse;
  }

  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies (for downstream handlers)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Create new response with updated cookies
          supabaseResponse = NextResponse.next({ request });
          // Re-apply CORS headers after creating new response
          if (isApiRoute) {
            addCorsHeaders(supabaseResponse, origin);
          }
          // Set cookies on response (for browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session - this will update cookies if tokens are refreshed
  // IMPORTANT: Use getUser() not getSession() to validate with Supabase Auth server
  try {
    await supabase.auth.getUser();
  } catch {
    // Auth refresh failed, continue without blocking the request
  }

  return supabaseResponse;
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
