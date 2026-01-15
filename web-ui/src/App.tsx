import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts';
import { Layout } from './components/layout';
import { BrowsePage, LearnPage, DashboardPage, EnterpriseDashboardPage, PersonalDashboardPage, ReportPage, ComparisonPage, PublicResultPage } from './pages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/personal" replace />} />
              <Route path="/browse" element={<BrowsePage />} />
              <Route path="/learn" element={<LearnPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/enterprise" element={<EnterpriseDashboardPage />} />
              <Route path="/personal" element={<PersonalDashboardPage />} />
              <Route path="/report/:reportId" element={<ReportPage />} />
              <Route path="/comparison" element={<ComparisonPage />} />
              <Route path="/comparison/:reportId" element={<ComparisonPage />} />
              <Route path="/r/:resultId" element={<PublicResultPage />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
