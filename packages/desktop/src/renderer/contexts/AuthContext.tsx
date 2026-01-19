/**
 * Auth Context
 *
 * Manages authentication state for the desktop app.
 * Handles OAuth flow via deep linking.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { createClient, type User, type Session } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from stored tokens
  useEffect(() => {
    async function initAuth() {
      try {
        const tokens = await window.electronAPI.getTokens();

        if (tokens.accessToken && tokens.refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          });

          if (!error && data.session) {
            setSession(data.session);
            setUser(data.user);
          } else {
            // Tokens invalid, clear them
            await window.electronAPI.clearTokens();
          }
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state changed:', event);

        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);

          // Store tokens
          await window.electronAPI.storeTokens({
            accessToken: newSession.access_token,
            refreshToken: newSession.refresh_token,
          });
        } else {
          setSession(null);
          setUser(null);
          await window.electronAPI.clearTokens();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Handle OAuth deep link callback
  useEffect(() => {
    console.log('[AuthContext] Setting up deep link listener...');

    const unsubscribe = window.electronAPI.onDeepLink(async (data) => {
      console.log('=== RENDERER DEEP LINK RECEIVED ===');
      console.log('R1. Deep link data:', JSON.stringify(data, null, 2));
      console.log('R2. Route:', data.route);
      console.log('R3. Params keys:', Object.keys(data.params));

      if (data.route === 'auth-callback') {
        console.log('R4. Auth callback route matched!');

        // Supabase sends tokens directly in hash fragment for custom URL schemes
        const accessToken = data.params.access_token;
        const refreshToken = data.params.refresh_token;

        console.log('R5. Access token present:', !!accessToken, 'length:', accessToken?.length);
        console.log('R6. Refresh token present:', !!refreshToken, 'length:', refreshToken?.length);

        if (accessToken && refreshToken) {
          try {
            console.log('R7. Calling supabase.auth.setSession...');
            // Set the session directly with the tokens
            const { data: authData, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('R8. setSession error:', error);
              throw error;
            }

            console.log('R8. setSession success!');
            console.log('R9. authData.session exists:', !!authData.session);
            console.log('R10. authData.user:', authData.user?.email);

            if (authData.session) {
              console.log('R11. Setting session and user state...');
              setSession(authData.session);
              setUser(authData.user);
              console.log('R12. Auth flow COMPLETE! User logged in.');
            }
          } catch (error) {
            console.error('OAuth callback error:', error);
          }
        } else {
          console.error('Missing tokens in callback. Params received:', data.params);
        }
      } else {
        console.log('R4. Route not auth-callback, ignoring:', data.route);
      }
    });

    console.log('[AuthContext] Deep link listener registered');
    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    console.log('[Auth] signInWithGoogle called');

    // Use web app's intermediate page instead of direct custom URL
    // This provides better UX: browser shows "Login successful!" instead of infinite loading
    // Flow: Supabase → web page → nomoreaislop://auth/callback
    const redirectTo = import.meta.env.VITE_APP_URL
      ? `${import.meta.env.VITE_APP_URL}/auth/desktop-callback`
      : 'https://nomoreaislop.app/auth/desktop-callback';

    // IMPORTANT: skipBrowserRedirect prevents Supabase from redirecting the current window
    // We want to open OAuth in the system browser, not inside Electron
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,  // Don't redirect current window!
      },
    });

    if (error) {
      console.error('[Auth] signInWithOAuth error:', error);
      throw error;
    }

    console.log('[Auth] OAuth URL received:', data.url?.substring(0, 50) + '...');

    if (data.url) {
      // Open OAuth URL in system browser via main process
      await window.electronAPI.openOAuth({
        provider: 'google',
        redirectUrl: data.url,
      });
    }
  }, []);

  const signInWithGitHub = useCallback(async () => {
    console.log('[Auth] signInWithGitHub called');

    // Use web app's intermediate page instead of direct custom URL
    const redirectTo = import.meta.env.VITE_APP_URL
      ? `${import.meta.env.VITE_APP_URL}/auth/desktop-callback`
      : 'https://nomoreaislop.app/auth/desktop-callback';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo,
        skipBrowserRedirect: true,  // Don't redirect current window!
      },
    });

    if (error) {
      console.error('[Auth] signInWithOAuth error:', error);
      throw error;
    }

    console.log('[Auth] OAuth URL received:', data.url?.substring(0, 50) + '...');

    if (data.url) {
      await window.electronAPI.openOAuth({
        provider: 'github',
        redirectUrl: data.url,
      });
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await window.electronAPI.clearTokens();
    setSession(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session,
        isLoading,
        signInWithGoogle,
        signInWithGitHub,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
