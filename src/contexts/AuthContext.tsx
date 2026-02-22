/**
 * Authentication Context
 * Provides auth state and methods throughout the app
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: (pendingResultId?: string) => Promise<{ error: Error | null }>;
  signInWithGitHub: (pendingResultId?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // If Supabase not configured, mark as not loading (all content will be gated)
    if (!isSupabaseConfigured() || !supabase) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Get initial session
    supabase.client.auth.getSession().then(({ data: { session } }) => {
      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
        isAuthenticated: !!session,
      });
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.client.auth.onAuthStateChange(
      (_event, session) => {
        setState({
          user: session?.user ?? null,
          session,
          isLoading: false,
          isAuthenticated: !!session,
        });
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Authentication not configured') };
    const { error } = await supabase.client.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Authentication not configured') };
    const { error } = await supabase.client.auth.signUp({ email, password });
    return { error };
  };

  const signInWithGoogle = async (pendingResultId?: string) => {
    if (!supabase) return { error: new Error('Authentication not configured') };
    const next = pendingResultId
      ? `/dashboard/r/${encodeURIComponent(pendingResultId)}`
      : '/dashboard/personal';
    const { error } = await supabase.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` }
    });
    return { error };
  };

  const signInWithGitHub = async (pendingResultId?: string) => {
    if (!supabase) return { error: new Error('Authentication not configured') };
    const next = pendingResultId
      ? `/dashboard/r/${encodeURIComponent(pendingResultId)}`
      : '/dashboard/personal';
    const { error } = await supabase.client.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` }
    });
    return { error };
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.client.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInWithGitHub,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
