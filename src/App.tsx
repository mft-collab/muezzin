import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { ErrorBoundary } from 'react-error-boundary';
import { Suspense, lazy } from 'react';
import { SplashLoader } from './components/SplashLoader';
import MuezzinAnaEkran from './pages/MuezzinAnaEkran';
import HaftalikTakvim from './pages/HaftalikTakvim';
import Profil from './pages/Profil';

const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'));

function Fallback({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-6 text-center">
      <h1 className="text-2xl font-bold text-red-600 mb-4">Sistemsel Hata Oluştu</h1>
      <pre className="text-sm bg-white p-4 rounded-xl border border-red-200 text-red-900 max-w-2xl overflow-auto w-full text-left">
        {error.message}
      </pre>
      <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-full">
        Uygulamayı Yeniden Başlat
      </button>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={Fallback}>
      <BrowserRouter>
        <AuthGuard>
          <Layout>
            <Suspense fallback={<SplashLoader />}>
              <Routes>
                <Route path="/" element={<MuezzinAnaEkran />} />
                <Route path="/takvim" element={<HaftalikTakvim />} />
                <Route path="/profil" element={<Profil />} />
                <Route path="/admin" element={<AdminPanel />} />
              </Routes>
            </Suspense>
          </Layout>
        </AuthGuard>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
