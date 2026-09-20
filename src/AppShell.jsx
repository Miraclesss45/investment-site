import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "./lib/i18n";
import { AuthProvider } from "./lib/auth";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import AdminRoute from "./components/routing/AdminRoute";
import ScrollToTop from "./components/routing/ScrollToTop";
import BrandLoader from "./components/ui/BrandLoader";

const HomePage = lazy(() => import("./pages/public/HomePage"));
const AboutPage = lazy(() => import("./pages/public/AboutPage"));
const BondsPage = lazy(() => import("./pages/public/BondsPage"));
const FaqPage = lazy(() => import("./pages/public/FaqPage"));
const TermsPage = lazy(() => import("./pages/public/TermsPage"));
const SupportPage = lazy(() => import("./pages/public/SupportPage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const SignupPage = lazy(() => import("./pages/auth/SignupPage"));
const VerifyEmailPage = lazy(() => import("./pages/auth/VerifyEmailPage"));
const DepositPendingPage = lazy(
  () => import("./pages/member/DepositPendingPage"),
);
const WithdrawalPendingPage = lazy(
  () => import("./pages/member/WithdrawalPendingPage"),
);
const DashboardPage = lazy(() => import("./pages/member/DashboardPage"));
const MemberFeaturePage = lazy(
  () => import("./pages/member/MemberFeaturePage"),
);
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const AdminPage = lazy(() => import("./pages/admin/AdminPage"));

function LoadingScreen() {
  return <BrandLoader />;
}

export default function AppShell() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ScrollToTop />
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/bonds" element={<BondsPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route
              path="/deposit-pending"
              element={
                <ProtectedRoute>
                  <DepositPendingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/withdrawal-pending"
              element={
                <ProtectedRoute>
                  <WithdrawalPendingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            {['deposit', 'withdraw', 'profile', 'transactions', 'referral'].map((path) => (
              <Route
                key={path}
                path={`/${path}`}
                element={
                  <ProtectedRoute>
                    <MemberFeaturePage />
                  </ProtectedRoute>
                }
              />
            ))}
            <Route path="/admin/login" element={<LoginPage />} />
            <Route
              path="/admin/*"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </LanguageProvider>
    </AuthProvider>
  );
}
