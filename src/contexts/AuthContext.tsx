'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  createdAt?: string;
  organizationId?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthApiUser {
  id: string;
  email: string;
  role: string;
  createdAt?: string;
  created_at?: string;
  organizationId?: string | null;
  organization_id?: string | null;
}

function mapAuthUser(user: AuthApiUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt ?? user.created_at,
    organizationId: user.organizationId ?? user.organization_id ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthContextType>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    let cancelled = false;

    const loadCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'same-origin',
          cache: 'no-store',
        });

        if (!response.ok) {
          if (!cancelled) {
            setState({
              user: null,
              isLoading: false,
              isAuthenticated: false,
            });
          }
          return;
        }

        const user = mapAuthUser(await response.json() as AuthApiUser);
        if (!cancelled) {
          setState({
            user,
            isLoading: false,
            isAuthenticated: true,
          });
        }
      } catch (error) {
        console.error('[AuthContext] Failed to load current user:', error);
        if (!cancelled) {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      }
    };

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={state}>
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
