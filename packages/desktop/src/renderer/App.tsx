import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AnalysisProvider } from './contexts/AnalysisContext';
import { QueryProvider } from './providers/QueryProvider';
import { Sidebar, type AppRoute } from './components/navigation';
import LoginPage from './pages/LoginPage';
import AnalyzePage from './pages/AnalyzePage';
import ResultsPage from './pages/ResultsPage';
import DashboardPage from './pages/DashboardPage';
import BrowsePage from './pages/BrowsePage';
import PersonalPage from './pages/PersonalPage';
import ComparisonPage from './pages/ComparisonPage';
import './styles/global.css';

function AppContent() {
  const { isAuthenticated, isLoading, user, signOut } = useAuth();
  const [route, setRoute] = useState<AppRoute>('login');
  const [resultId, setResultId] = useState<string | null>(null);

  // Handle authentication state
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setRoute('login');
      } else if (route === 'login') {
        setRoute('analyze');
      }
    }
  }, [isAuthenticated, isLoading, route]);

  // Handle deep links
  useEffect(() => {
    console.log('[App] Registering deep link handler...');
    const unsubscribe = window.electronAPI.onDeepLink((data) => {
      console.log('[App] ========== DEEP LINK RECEIVED ==========');
      console.log('[App] Route:', data.route);
      console.log('[App] Params:', data.params);
      console.log('[App] Current route state:', route);
      console.log('[App] Current resultId state:', resultId);

      if (data.route === 'auth-callback') {
        // Auth callback is handled by AuthContext
        // Just need to wait for auth state to update
        console.log('[App] Auth callback - waiting for AuthContext');
      }

      if (data.route === 'payment-success' && data.params.resultId) {
        console.log('[App] Payment success - setting resultId and navigating to results');
        setResultId(data.params.resultId);
        setRoute('results');
      }
    });
    console.log('[App] Deep link handler registered');

    return unsubscribe;
  }, [route, resultId]);

  // Navigation functions
  const navigateToResults = (id: string) => {
    setResultId(id);
    setRoute('results');
  };

  const handleSignOut = async () => {
    await signOut();
    setRoute('login');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  // Login page (no sidebar)
  if (route === 'login' || !isAuthenticated) {
    return <LoginPage />;
  }

  // Render with sidebar
  return (
    <div className="app-layout">
      <Sidebar
        currentRoute={route}
        onNavigate={setRoute}
        onSignOut={handleSignOut}
        userName={user?.email?.split('@')[0]}
      />
      <main className="app-main">
        {renderPage()}
      </main>
    </div>
  );

  function renderPage() {
    switch (route) {
      case 'analyze':
        return <AnalyzePage onAnalysisComplete={navigateToResults} />;
      case 'results':
        return (
          <ResultsPage
            resultId={resultId!}
            onBack={() => setRoute('analyze')}
          />
        );
      case 'dashboard':
        return <DashboardPage />;
      case 'browse':
        return <BrowsePage />;
      case 'personal':
        return (
          <PersonalPage
            onViewReport={(id) => {
              setResultId(id);
              setRoute('results');
            }}
          />
        );
      case 'comparison':
        return (
          <ComparisonPage
            reportId={resultId}
            onBack={() => setRoute('results')}
          />
        );
      default:
        return <AnalyzePage onAnalysisComplete={navigateToResults} />;
    }
  }
}

export default function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <AnalysisProvider>
          <AppContent />
        </AnalysisProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
