import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  createdAt?: string;
}

interface AuthState {
  user: AuthUser | null;
  session: null;
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

interface AuthApiUser {
  id: string;
  email: string;
  role: string;
  createdAt?: string;
  created_at?: string;
}

function mapAuthUser(user: AuthApiUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt ?? user.created_at,
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
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
              session: null,
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
            session: null,
            isLoading: false,
            isAuthenticated: true,
          });
        }
      } catch (error) {
        console.error('[AuthContext] Failed to load current user:', error);
        if (!cancelled) {
          setState({
            user: null,
            session: null,
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

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });

      const data = await readJson(response);
      if (!response.ok) {
        return {
          error: new Error(
            typeof data.message === 'string' ? data.message : 'Failed to sign in'
          ),
        };
      }

      const user = mapAuthUser(data.user as AuthApiUser);
      setState({
        user,
        session: null,
        isLoading: false,
        isAuthenticated: true,
      });

      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Failed to sign in'),
      };
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });

      const data = await readJson(response);
      if (!response.ok) {
        return {
          error: new Error(
            typeof data.message === 'string' ? data.message : 'Failed to create account'
          ),
        };
      }

      const user = mapAuthUser(data.user as AuthApiUser);
      setState({
        user,
        session: null,
        isLoading: false,
        isAuthenticated: true,
      });

      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Failed to create account'),
      };
    }
  };

  const signInWithGoogle = async (pendingResultId?: string) => {
    void pendingResultId;
    return { error: new Error('Google sign-in is not available in the self-hosted build') };
  };

  const signInWithGitHub = async (pendingResultId?: string) => {
    void pendingResultId;
    return { error: new Error('GitHub sign-in is not available in the self-hosted build') };
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch((error) => {
      console.error('[AuthContext] Failed to clear session:', error);
    });

    setState({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithGitHub,
        signOut,
      }}
    >
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
