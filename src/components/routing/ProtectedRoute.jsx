import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/authContext";
import BrandLoader from "../ui/BrandLoader";

export default function ProtectedRoute({ children }) {
  const { user, loading, error } = useAuth();
  const location = useLocation();

  if (loading) {
    return <BrandLoader label="Checking your MeridianVests session" />;
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-6 text-center text-slate-900">
        <div className="max-w-md">
          <h1 className="text-xl font-bold">We could not load your session</h1>
          <p className="mt-3 text-sm text-slate-300">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-lg bg-sky-400 px-4 py-3 text-sm font-bold text-slate-950">Try again</button>
        </div>
      </div>
    );
  }

  if (!user || !user.emailVerified) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
