import { Navigate, useLocation } from "react-router-dom";
import BrandLoader from "../ui/BrandLoader";
import { useAuth } from "../../lib/authContext";

export default function AdminRoute({ children }) {
  const location = useLocation();
  const { user, isAdmin, loading, error } = useAuth();

  if (loading) {
    return <BrandLoader label="Checking admin access" />;
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#07111d] px-6 text-center text-white">
        <div className="max-w-md">
          <h1 className="text-xl font-bold">We could not verify admin access</h1>
          <p className="mt-3 text-sm text-slate-300">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-lg bg-sky-400 px-4 py-3 text-sm font-bold text-slate-950">Try again</button>
        </div>
      </div>
    );
  }

  if (!user || !user.emailVerified) {
    return (
      <Navigate
        to="/control-room/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return children;
}
